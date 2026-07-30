begin;

create table public.live_channels (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  title_en text not null,
  title_ur text,
  description_en text,
  poster_url text,
  access_level public.access_level not null default 'public',
  provider text not null default 'cloudflare_stream' check (provider in ('cloudflare_stream','self_hosted','external')),
  provider_input_id text,
  playback_hls_url text,
  playback_dash_url text,
  status text not null default 'offline' check (status in ('offline','scheduled','starting','live','degraded','ended')),
  is_published boolean not null default false,
  recording_enabled boolean not null default true,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger live_channels_touch before update on public.live_channels for each row execute procedure public.touch_updated_at();
create index live_channels_public_idx on public.live_channels(is_published,status,updated_at desc);

create table public.live_events (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.live_channels(id) on delete cascade,
  title_en text not null,
  title_ur text,
  description_en text,
  scheduled_start timestamptz not null,
  scheduled_end timestamptz,
  actual_start timestamptz,
  actual_end timestamptz,
  status text not null default 'scheduled' check (status in ('draft','scheduled','live','ended','cancelled')),
  recording_content_id uuid references public.content_items(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (scheduled_end is null or scheduled_end>scheduled_start)
);

create trigger live_events_touch before update on public.live_events for each row execute procedure public.touch_updated_at();
create index live_events_schedule_idx on public.live_events(status,scheduled_start);

create table public.live_health_checks (
  id bigint generated always as identity primary key,
  channel_id uuid not null references public.live_channels(id) on delete cascade,
  provider_status text,
  ingest_connected boolean not null default false,
  playback_healthy boolean not null default false,
  latency_ms integer,
  details jsonb not null default '{}'::jsonb,
  checked_at timestamptz not null default now()
);

create index live_health_recent_idx on public.live_health_checks(channel_id,checked_at desc);

create table public.live_viewer_sessions (
  id uuid primary key default gen_random_uuid(),
  channel_id uuid not null references public.live_channels(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  viewer_profile_id uuid references public.viewer_profiles(id) on delete set null,
  session_key text not null,
  started_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  ended_at timestamptz,
  watch_seconds integer not null default 0 check (watch_seconds>=0),
  quality text,
  country_code text,
  unique(channel_id,session_key)
);

create index live_viewer_active_idx on public.live_viewer_sessions(channel_id,last_seen_at desc) where ended_at is null;

create table public.drm_policies (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  key_systems text[] not null default array['com.widevine.alpha','com.apple.fps'],
  licence_duration_seconds integer not null default 21600 check (licence_duration_seconds between 300 and 604800),
  playback_duration_seconds integer check (playback_duration_seconds is null or playback_duration_seconds between 300 and 604800),
  renewal_enabled boolean not null default true,
  max_concurrent_devices integer not null default 2 check (max_concurrent_devices between 1 and 10),
  minimum_security_level text not null default 'software' check (minimum_security_level in ('software','hardware')),
  hdcp_required text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger drm_policies_touch before update on public.drm_policies for each row execute procedure public.touch_updated_at();

insert into public.drm_policies(name) values('Premium browser default') on conflict do nothing;

create table public.drm_assets (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null unique references public.content_items(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  policy_id uuid not null references public.drm_policies(id),
  provider text not null check (provider in ('widevine_fairplay_proxy','external_multi_drm')),
  provider_asset_ref text,
  key_id text,
  manifest_hls_path text,
  manifest_dash_path text,
  certificate_url text,
  status text not null default 'pending' check (status in ('pending','packaging','ready','failed','revoked')),
  key_systems jsonb not null default '{}'::jsonb,
  packaging_metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger drm_assets_touch before update on public.drm_assets for each row execute procedure public.touch_updated_at();

alter table public.playback_sources add column if not exists drm_asset_id uuid references public.drm_assets(id) on delete set null;

create table public.drm_packaging_jobs (
  id uuid primary key default gen_random_uuid(),
  drm_asset_id uuid not null references public.drm_assets(id) on delete cascade,
  status text not null default 'queued' check (status in ('queued','processing','completed','failed')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  error_message text,
  output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index drm_packaging_queue_idx on public.drm_packaging_jobs(status,available_at) where status='queued';

create table public.drm_license_events (
  id bigint generated always as identity primary key,
  drm_asset_id uuid not null references public.drm_assets(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete set null,
  device_id uuid references public.user_devices(id) on delete set null,
  key_system text not null,
  status text not null check (status in ('allowed','denied','upstream_error')),
  reason text,
  request_id text not null,
  response_ms integer,
  created_at timestamptz not null default now()
);

create index drm_license_events_audit_idx on public.drm_license_events(drm_asset_id,created_at desc);
create index drm_license_events_user_idx on public.drm_license_events(user_id,created_at desc);

create or replace function public.claim_drm_packaging_job(p_worker_id text)
returns setof public.drm_packaging_jobs
language plpgsql
security definer set search_path=''
as $$
declare v_id uuid;
begin
  select id into v_id from public.drm_packaging_jobs
  where status='queued' and available_at<=now()
  order by created_at
  for update skip locked limit 1;
  if v_id is null then return; end if;
  return query update public.drm_packaging_jobs
    set status='processing',attempts=attempts+1,locked_at=now(),locked_by=left(p_worker_id,120)
    where id=v_id returning *;
end;
$$;

create or replace function public.touch_live_session(p_channel_id uuid,p_session_key text,p_viewer_profile_id uuid default null,p_watch_seconds integer default 0,p_quality text default null)
returns uuid
language plpgsql
security definer set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
begin
  if p_viewer_profile_id is not null and not exists(select 1 from public.viewer_profiles where id=p_viewer_profile_id and user_id=v_user) then raise exception 'viewer profile unavailable'; end if;
  insert into public.live_viewer_sessions(channel_id,user_id,viewer_profile_id,session_key,last_seen_at,watch_seconds,quality)
  values(p_channel_id,v_user,p_viewer_profile_id,left(p_session_key,120),now(),greatest(coalesce(p_watch_seconds,0),0),left(p_quality,40))
  on conflict(channel_id,session_key) do update set last_seen_at=now(),watch_seconds=greatest(public.live_viewer_sessions.watch_seconds,excluded.watch_seconds),quality=coalesce(excluded.quality,public.live_viewer_sessions.quality)
  returning id into v_id;
  return v_id;
end;
$$;

grant execute on function public.touch_live_session(uuid,text,uuid,integer,text) to anon,authenticated;

alter table public.live_channels enable row level security;
alter table public.live_events enable row level security;
alter table public.live_health_checks enable row level security;
alter table public.live_viewer_sessions enable row level security;
alter table public.drm_policies enable row level security;
alter table public.drm_assets enable row level security;
alter table public.drm_packaging_jobs enable row level security;
alter table public.drm_license_events enable row level security;

create policy "published live channels public read" on public.live_channels for select using(is_published);
create policy "published live events public read" on public.live_events for select using(exists(select 1 from public.live_channels c where c.id=channel_id and c.is_published) and status<>'draft');
create policy "live staff manage channels" on public.live_channels for all to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('editor','admin'))) with check(exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('editor','admin')));
create policy "live staff manage events" on public.live_events for all to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('editor','admin'))) with check(exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('editor','admin')));
create policy "live health staff read" on public.live_health_checks for select to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('editor','admin')));
create policy "live sessions own read" on public.live_viewer_sessions for select to authenticated using(user_id=(select auth.uid()));
create policy "drm policies staff manage" on public.drm_policies for all to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin')) with check(exists(select 1 from public.profiles where id=(select auth.uid()) and role='admin'));
create policy "drm assets staff read" on public.drm_assets for select to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('editor','rights_reviewer','admin')));
create policy "drm jobs staff read" on public.drm_packaging_jobs for select to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('editor','admin')));
create policy "drm events own read" on public.drm_license_events for select to authenticated using(user_id=(select auth.uid()));
create policy "drm events staff read" on public.drm_license_events for select to authenticated using(exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('support','admin')));

commit;
