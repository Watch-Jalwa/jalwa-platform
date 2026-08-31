begin;

create type public.media_asset_kind as enum ('source_video','short_mp4','hls_manifest','hls_segment','poster','caption','thumbnail');
create type public.media_asset_status as enum ('pending_upload','uploaded','queued','processing','ready','failed','removed');
create type public.media_job_type as enum ('short_mp4','hls');
create type public.media_job_status as enum ('queued','processing','completed','failed');

create table public.media_assets (
  id uuid primary key default gen_random_uuid(),
  content_id uuid not null references public.content_items(id) on delete cascade,
  parent_asset_id uuid references public.media_assets(id) on delete cascade,
  kind public.media_asset_kind not null,
  status public.media_asset_status not null default 'pending_upload',
  storage_key text not null unique,
  mime_type text,
  size_bytes bigint check(size_bytes is null or size_bytes >= 0),
  checksum text,
  width integer,
  height integer,
  duration_seconds integer,
  metadata jsonb not null default '{}'::jsonb,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.media_jobs (
  id uuid primary key default gen_random_uuid(),
  media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  job_type public.media_job_type not null,
  status public.media_job_status not null default 'queued',
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  completed_at timestamptz,
  error_message text,
  output jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.playback_sources
  add column media_asset_id uuid references public.media_assets(id) on delete set null,
  add column format text check(format is null or format in ('youtube','mp4','hls','external'));

create unique index media_jobs_active_asset_idx on public.media_jobs(media_asset_id)
  where status in ('queued','processing');
create index media_jobs_claim_idx on public.media_jobs(status,available_at,created_at);
create index media_assets_content_idx on public.media_assets(content_id,status);
create index playback_media_asset_idx on public.playback_sources(media_asset_id);

create trigger media_assets_touch before update on public.media_assets
for each row execute procedure public.touch_updated_at();
create trigger media_jobs_touch before update on public.media_jobs
for each row execute procedure public.touch_updated_at();

create or replace function public.claim_media_job(p_worker_id text)
returns setof public.media_jobs
language plpgsql security definer set search_path=''
as $$
declare v_job public.media_jobs;
begin
  select * into v_job
  from public.media_jobs
  where status='queued' and available_at<=now() and attempts<max_attempts
  order by created_at
  for update skip locked
  limit 1;

  if v_job.id is null then return; end if;

  update public.media_jobs
  set status='processing', locked_at=now(), locked_by=p_worker_id, attempts=attempts+1
  where id=v_job.id
  returning * into v_job;

  update public.media_assets set status='processing' where id=v_job.media_asset_id;
  return next v_job;
end $$;

create or replace function public.enforce_self_hosted_publish_ready()
returns trigger language plpgsql security definer set search_path=''
as $$
begin
  if new.status='published'
    and new.hosting_mode in ('self_host_open','self_host_owned')
    and old.status is distinct from 'published'
    and not exists (
      select 1 from public.playback_sources p
      join public.media_assets a on a.id=p.media_asset_id
      where p.content_id=new.id and p.is_primary and p.status='active' and a.status='ready'
    )
  then
    raise exception 'ready self-hosted playback source required before publishing';
  end if;
  return new;
end $$;

create trigger enforce_self_hosted_publish
before update on public.content_items
for each row execute procedure public.enforce_self_hosted_publish_ready();

grant execute on function public.claim_media_job(text) to service_role;

alter table public.media_assets enable row level security;
alter table public.media_jobs enable row level security;

create policy "staff media assets read" on public.media_assets
for select to authenticated using(public.is_staff());
create policy "staff media assets create" on public.media_assets
for insert to authenticated with check(public.is_staff() and created_by=(select auth.uid()));
create policy "staff media assets update" on public.media_assets
for update to authenticated using(public.is_staff()) with check(public.is_staff());

create policy "staff media jobs read" on public.media_jobs
for select to authenticated using(public.is_staff());
create policy "staff media jobs create" on public.media_jobs
for insert to authenticated with check(public.is_staff());

commit;
