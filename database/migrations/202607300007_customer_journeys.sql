begin;

alter table public.profiles
  add column if not exists onboarding_completed boolean not null default false,
  add column if not exists accepted_terms_at timestamptz,
  add column if not exists marketing_opt_in boolean not null default false;

create table public.viewer_profiles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 40),
  profile_type text not null default 'adult' check (profile_type in ('adult','teen','child')),
  avatar_key text not null default 'spark' check (avatar_key in ('spark','moon','leaf','kite','star','book')),
  preferred_language text not null default 'en' check (preferred_language in ('en','ur','roman_ur')),
  is_default boolean not null default false,
  kids_mode boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(user_id,name),
  unique(user_id,id)
);

create unique index viewer_profiles_one_default_idx
  on public.viewer_profiles(user_id) where is_default;

create or replace function public.enforce_viewer_profile_limit()
returns trigger
language plpgsql
security definer set search_path=''
as $$
begin
  if (select count(*) from public.viewer_profiles where user_id=new.user_id) >= 5 then
    raise exception 'A Jalwa account can have up to five viewer profiles.';
  end if;
  if new.profile_type='child' then new.kids_mode := true; end if;
  return new;
end;
$$;

create trigger viewer_profile_limit_before_insert
before insert on public.viewer_profiles
for each row execute procedure public.enforce_viewer_profile_limit();

create trigger viewer_profiles_touch
before update on public.viewer_profiles
for each row execute procedure public.touch_updated_at();

create or replace function public.create_default_viewer_profile()
returns trigger
language plpgsql
security definer set search_path=''
as $$
begin
  insert into public.viewer_profiles(user_id,name,is_default,preferred_language)
  values(new.id,coalesce(nullif(trim(new.display_name),''),'Jalwa User'),true,new.preferred_language)
  on conflict do nothing;
  return new;
end;
$$;

create trigger create_default_viewer_profile_after_profile
  after insert on public.profiles
  for each row execute procedure public.create_default_viewer_profile();

insert into public.viewer_profiles(user_id,name,is_default,preferred_language)
select p.id,coalesce(nullif(trim(p.display_name),''),'Jalwa User'),true,p.preferred_language
from public.profiles p
where not exists(select 1 from public.viewer_profiles vp where vp.user_id=p.id)
on conflict do nothing;

create table public.watch_progress (
  user_id uuid not null references auth.users(id) on delete cascade,
  viewer_profile_id uuid not null,
  content_id uuid not null references public.content_items(id) on delete cascade,
  position_seconds integer not null default 0 check (position_seconds >= 0),
  duration_seconds integer check (duration_seconds is null or duration_seconds >= 0),
  completed boolean not null default false,
  last_watched_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(user_id,viewer_profile_id,content_id),
  foreign key(user_id,viewer_profile_id) references public.viewer_profiles(user_id,id) on delete cascade
);

create index watch_progress_recent_idx on public.watch_progress(user_id,viewer_profile_id,last_watched_at desc);
create trigger watch_progress_touch before update on public.watch_progress for each row execute procedure public.touch_updated_at();

create table public.user_devices (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  device_key text not null check (char_length(device_key) between 8 and 160),
  display_name text not null default 'Web browser',
  platform text,
  user_agent text,
  last_seen_at timestamptz not null default now(),
  revoked_at timestamptz,
  created_at timestamptz not null default now(),
  unique(user_id,device_key)
);

create index user_devices_active_idx on public.user_devices(user_id,last_seen_at desc) where revoked_at is null;

create table public.offline_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  viewer_profile_id uuid not null,
  content_id uuid not null references public.content_items(id) on delete cascade,
  cache_key text not null,
  bytes_downloaded bigint not null default 0 check (bytes_downloaded >= 0),
  downloaded_at timestamptz not null default now(),
  expires_at timestamptz,
  foreign key(user_id,viewer_profile_id) references public.viewer_profiles(user_id,id) on delete cascade,
  unique(user_id,viewer_profile_id,content_id)
);

create table public.playback_source_health (
  playback_source_id uuid primary key references public.playback_sources(id) on delete cascade,
  status text not null default 'unknown' check (status in ('unknown','healthy','degraded','unavailable')),
  consecutive_failures integer not null default 0,
  checked_at timestamptz,
  message text,
  updated_at timestamptz not null default now()
);

create trigger playback_source_health_touch before update on public.playback_source_health for each row execute procedure public.touch_updated_at();

create or replace function public.upsert_watch_progress(
  p_viewer_profile_id uuid,
  p_content_id uuid,
  p_position_seconds integer,
  p_duration_seconds integer default null,
  p_completed boolean default false
) returns void
language plpgsql
security definer set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if not exists(select 1 from public.viewer_profiles where id=p_viewer_profile_id and user_id=v_user) then
    raise exception 'viewer profile unavailable';
  end if;
  insert into public.watch_progress(user_id,viewer_profile_id,content_id,position_seconds,duration_seconds,completed,last_watched_at)
  values(v_user,p_viewer_profile_id,p_content_id,greatest(p_position_seconds,0),p_duration_seconds,p_completed,now())
  on conflict(user_id,viewer_profile_id,content_id)
  do update set position_seconds=excluded.position_seconds,
                duration_seconds=coalesce(excluded.duration_seconds,public.watch_progress.duration_seconds),
                completed=excluded.completed,
                last_watched_at=now();
end;
$$;

create or replace function public.register_device(
  p_device_key text,
  p_display_name text,
  p_platform text,
  p_user_agent text
) returns uuid
language plpgsql
security definer set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user is null then raise exception 'authentication required'; end if;
  if exists(select 1 from public.user_devices where user_id=v_user and device_key=p_device_key and revoked_at is not null) then
    raise exception 'device revoked';
  end if;
  if not exists(select 1 from public.user_devices where user_id=v_user and device_key=p_device_key)
     and (select count(*) from public.user_devices where user_id=v_user and revoked_at is null) >= 5 then
    raise exception 'active device limit reached';
  end if;
  insert into public.user_devices(user_id,device_key,display_name,platform,user_agent,last_seen_at)
  values(v_user,p_device_key,left(coalesce(nullif(trim(p_display_name),''),'Web browser'),80),left(p_platform,80),left(p_user_agent,500),now())
  on conflict(user_id,device_key)
  do update set display_name=excluded.display_name,platform=excluded.platform,user_agent=excluded.user_agent,last_seen_at=now()
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function public.request_subscription_cancellation(p_subscription_id uuid)
returns void
language plpgsql
security definer set search_path=''
as $$
declare
  v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'authentication required'; end if;
  update public.subscriptions
  set cancel_at_period_end=true,
      status=case when status='active' then 'cancel_at_period_end'::public.subscription_status else status end
  where id=p_subscription_id and user_id=v_user and status in ('active','past_due','cancel_at_period_end');
  if not found then raise exception 'subscription unavailable'; end if;
  insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
  values(v_user,'subscription_cancellation_requested','subscription',p_subscription_id::text,'{}'::jsonb);
end;
$$;

grant execute on function public.upsert_watch_progress(uuid,uuid,integer,integer,boolean) to authenticated;
grant execute on function public.register_device(text,text,text,text) to authenticated;
grant execute on function public.request_subscription_cancellation(uuid) to authenticated;

alter table public.viewer_profiles enable row level security;
alter table public.watch_progress enable row level security;
alter table public.user_devices enable row level security;
alter table public.offline_items enable row level security;
alter table public.playback_source_health enable row level security;

create policy "viewer profiles own read" on public.viewer_profiles for select to authenticated using(user_id=(select auth.uid()));
create policy "viewer profiles own insert" on public.viewer_profiles for insert to authenticated with check(user_id=(select auth.uid()));
create policy "viewer profiles own update" on public.viewer_profiles for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "viewer profiles own delete" on public.viewer_profiles for delete to authenticated using(user_id=(select auth.uid()) and not is_default);

create policy "watch progress own read" on public.watch_progress for select to authenticated using(user_id=(select auth.uid()));
create policy "watch progress own delete" on public.watch_progress for delete to authenticated using(user_id=(select auth.uid()));

create policy "devices own read" on public.user_devices for select to authenticated using(user_id=(select auth.uid()));
create policy "devices own update" on public.user_devices for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));

create policy "offline items own read" on public.offline_items for select to authenticated using(user_id=(select auth.uid()));
create policy "offline items own insert" on public.offline_items for insert to authenticated with check(user_id=(select auth.uid()));
create policy "offline items own update" on public.offline_items for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy "offline items own delete" on public.offline_items for delete to authenticated using(user_id=(select auth.uid()));

create policy "source health public read" on public.playback_source_health for select using(true);
create policy "source health staff manage" on public.playback_source_health for all to authenticated
using(exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('editor','admin')))
with check(exists(select 1 from public.profiles where id=(select auth.uid()) and role in ('editor','admin')));

commit;
