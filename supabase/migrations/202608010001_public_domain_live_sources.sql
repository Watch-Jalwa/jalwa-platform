-- Public-domain live-source contract. Provider enum values are committed before
-- they can be referenced by later seed/operational transactions.
begin;
alter type public.source_provider add value if not exists 'noaa';
alter type public.source_provider add value if not exists 'usgs';
commit;

begin;

do $$
begin
  create type public.live_delivery_adapter as enum ('official_live_embed', 'public_domain_live_image');
exception when duplicate_object then null;
end $$;

create table if not exists public.live_source_configs (
  playback_source_id uuid primary key references public.playback_sources(id) on delete cascade,
  source_key text not null unique check (source_key ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'),
  delivery_adapter public.live_delivery_adapter not null,
  official_source_url text not null check (official_source_url ~ '^https://'),
  terms_url text not null check (terms_url ~ '^https://'),
  allowed_hosts text[] not null check (cardinality(allowed_hosts) between 1 and 12),
  expected_media_type text not null check (expected_media_type in ('official_embed', 'current_image')),
  refresh_interval_seconds integer not null default 900 check (refresh_interval_seconds between 60 and 86400),
  freshness_threshold_seconds integer not null default 86400 check (freshness_threshold_seconds between 300 and 2592000),
  off_air_allowed boolean not null default false,
  required_attribution text not null check (char_length(required_attribution) between 3 and 1000),
  rights_verified_at timestamptz,
  next_review_at timestamptz,
  enabled boolean not null default false,
  operations_owner text not null default 'content-operations' check (char_length(operations_owner) between 3 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (next_review_at is null or rights_verified_at is not null),
  check (next_review_at is null or next_review_at > rights_verified_at)
);

create table if not exists public.playback_source_health (
  playback_source_id uuid primary key references public.playback_sources(id) on delete cascade,
  status text not null default 'degraded' check (status in ('healthy','degraded','unavailable')),
  consecutive_failures integer not null default 0 check (consecutive_failures >= 0),
  checked_at timestamptz not null default now(),
  message text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.playback_source_health
  add column if not exists availability text not null default 'degraded',
  add column if not exists last_success_at timestamptz,
  add column if not exists source_timestamp timestamptz,
  add column if not exists etag text,
  add column if not exists last_modified text,
  add column if not exists content_hash text,
  add column if not exists availability_reason text,
  add column if not exists terms_review_due boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table public.playback_source_health drop constraint if exists playback_source_health_availability_check;
alter table public.playback_source_health add constraint playback_source_health_availability_check
  check (availability in ('healthy','degraded','off_air','unavailable'));

create index if not exists live_source_configs_enabled_idx
  on public.live_source_configs(enabled, next_review_at);
create index if not exists playback_source_health_availability_idx
  on public.playback_source_health(availability, checked_at desc);

create or replace function public.touch_live_source_config()
returns trigger language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists live_source_configs_touch on public.live_source_configs;
create trigger live_source_configs_touch before update on public.live_source_configs
for each row execute procedure public.touch_live_source_config();

drop trigger if exists playback_source_health_touch on public.playback_source_health;
create trigger playback_source_health_touch before update on public.playback_source_health
for each row execute procedure public.touch_live_source_config();

create or replace function public.enforce_public_domain_live_publish_ready()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_config public.live_source_configs;
begin
  if new.status = 'published' and new.content_type = 'live' and old.status is distinct from 'published' then
    select l.* into v_config
    from public.playback_sources p
    join public.live_source_configs l on l.playback_source_id = p.id
    where p.content_id = new.id and p.is_primary
    limit 1;

    if v_config.playback_source_id is not null then
      if new.access_level <> 'public' then raise exception 'approved agency live sources must remain public'; end if;
      if not v_config.enabled then raise exception 'live source configuration must be enabled before publication'; end if;
      if v_config.rights_verified_at is null or v_config.next_review_at is null or v_config.next_review_at <= now() then
        raise exception 'current live-source rights review required before publication';
      end if;
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists enforce_public_domain_live_publish on public.content_items;
create trigger enforce_public_domain_live_publish
before update on public.content_items
for each row execute procedure public.enforce_public_domain_live_publish_ready();

alter table public.live_source_configs enable row level security;
alter table public.playback_source_health enable row level security;

drop policy if exists "public current live source configs" on public.live_source_configs;
create policy "public current live source configs" on public.live_source_configs
for select to anon, authenticated
using (enabled and rights_verified_at is not null and next_review_at > now());

drop policy if exists "live source team manages configs" on public.live_source_configs;
create policy "live source team manages configs" on public.live_source_configs
for all to authenticated
using (public.can_manage_catalogue() or public.can_review_rights())
with check (public.can_manage_catalogue() or public.can_review_rights());

drop policy if exists "public published source health" on public.playback_source_health;
create policy "public published source health" on public.playback_source_health
for select to anon, authenticated
using (exists (
  select 1 from public.playback_sources p
  join public.content_items c on c.id = p.content_id
  where p.id = playback_source_id and c.status = 'published'
));

drop policy if exists "operations manages source health" on public.playback_source_health;
create policy "operations manages source health" on public.playback_source_health
for all to service_role using (true) with check (true);

grant select on public.live_source_configs, public.playback_source_health to anon, authenticated;
grant insert, update, delete on public.live_source_configs to authenticated;
grant all on public.playback_source_health to service_role;

commit;
