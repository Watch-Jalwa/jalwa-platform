begin;

create table if not exists public.source_accounts (
  id uuid primary key default gen_random_uuid(),
  source_key text not null unique,
  provider text not null,
  name text not null,
  content_lane text,
  primary_media text,
  languages text,
  allowed_use text,
  accepted_rights_basis text,
  confidence text,
  item_level_check_required boolean not null default true,
  direct_download_or_api text,
  estimated_scale text,
  attribution_restrictions text,
  source_url text not null,
  rights_evidence_url text not null,
  recommendation text,
  copyright_approved boolean not null default false,
  approved_for_discovery boolean not null default false,
  is_enabled boolean not null default false,
  reviewed_at timestamptz,
  next_review_at timestamptz,
  disabled_reason text,
  disabled_at timestamptz,
  disabled_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.source_accounts
  add column if not exists source_key text,
  add column if not exists name text,
  add column if not exists content_lane text,
  add column if not exists primary_media text,
  add column if not exists languages text,
  add column if not exists allowed_use text,
  add column if not exists accepted_rights_basis text,
  add column if not exists confidence text,
  add column if not exists item_level_check_required boolean not null default true,
  add column if not exists direct_download_or_api text,
  add column if not exists estimated_scale text,
  add column if not exists attribution_restrictions text,
  add column if not exists rights_evidence_url text,
  add column if not exists recommendation text,
  add column if not exists copyright_approved boolean not null default false,
  add column if not exists approved_for_discovery boolean not null default false,
  add column if not exists is_enabled boolean not null default false,
  add column if not exists reviewed_at timestamptz,
  add column if not exists next_review_at timestamptz,
  add column if not exists disabled_reason text,
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_by uuid references auth.users(id),
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

create unique index if not exists source_accounts_source_key_idx
  on public.source_accounts(source_key);
create index if not exists source_accounts_enabled_idx
  on public.source_accounts(is_enabled, approved_for_discovery);

create table if not exists public.source_items (
  id uuid primary key default gen_random_uuid(),
  source_account_id uuid not null references public.source_accounts(id) on delete cascade,
  external_id text not null,
  source_url text not null,
  title text not null,
  description text,
  media_type text,
  language text,
  creator text,
  licence_code text,
  licence_url text,
  direct_media_url text,
  thumbnail_url text,
  duration_seconds integer check(duration_seconds is null or duration_seconds >= 0),
  rights_state text not null default 'candidate'
    check(rights_state in ('candidate', 'validated', 'rejected', 'hold')),
  ingestion_status text not null default 'discovered'
    check(ingestion_status in ('discovered', 'reviewed', 'approved', 'rejected', 'imported')),
  content_id uuid references public.content_items(id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  discovered_at timestamptz not null default now(),
  reviewed_at timestamptz,
  reviewed_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_account_id, external_id)
);

create index if not exists source_items_review_queue_idx
  on public.source_items(ingestion_status, rights_state, discovered_at);
create index if not exists source_items_source_idx
  on public.source_items(source_account_id, discovered_at desc);

create table if not exists public.source_download_jobs (
  id uuid primary key default gen_random_uuid(),
  source_item_id uuid not null references public.source_items(id) on delete cascade,
  media_asset_id uuid not null references public.media_assets(id) on delete cascade,
  status text not null default 'queued'
    check(status in ('queued', 'processing', 'completed', 'failed')),
  attempts integer not null default 0,
  max_attempts integer not null default 3,
  available_at timestamptz not null default now(),
  locked_at timestamptz,
  locked_by text,
  completed_at timestamptz,
  error_message text,
  cancel_requested boolean not null default false,
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(source_item_id),
  unique(media_asset_id)
);

create index if not exists source_download_jobs_claim_idx
  on public.source_download_jobs(status, available_at, created_at)
  where not cancel_requested;

alter table public.content_items
  add column if not exists source_account_id uuid references public.source_accounts(id) on delete set null,
  add column if not exists is_available boolean not null default false,
  add column if not exists disabled_reason text,
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_by uuid references auth.users(id);

alter table public.playback_sources
  add column if not exists is_available boolean not null default false,
  add column if not exists disabled_reason text,
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_by uuid references auth.users(id);

alter table public.media_assets
  add column if not exists is_available boolean not null default false,
  add column if not exists disabled_reason text,
  add column if not exists disabled_at timestamptz,
  add column if not exists disabled_by uuid references auth.users(id);

alter table public.rights_records
  add column if not exists rights_hold boolean not null default false,
  add column if not exists rights_hold_reason text,
  add column if not exists rights_hold_at timestamptz,
  add column if not exists rights_hold_by uuid references auth.users(id);

alter table public.media_jobs
  add column if not exists cancel_requested boolean not null default false,
  add column if not exists cancellation_reason text;

create table if not exists public.platform_runtime_flags (
  key text primary key,
  enabled boolean not null default false,
  notes text,
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

insert into public.platform_runtime_flags(key, enabled, notes)
values
  ('internal_alpha_enabled', false, 'Fail-closed until protected staging activation.'),
  ('internal_alpha_invite_only', true, 'Only staff and explicit alpha access grants may use the catalogue.')
on conflict(key) do nothing;

create table if not exists public.alpha_access_grants (
  user_id uuid primary key references auth.users(id) on delete cascade,
  enabled boolean not null default true,
  expires_at timestamptz,
  granted_by uuid references auth.users(id),
  reason text not null,
  granted_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create index if not exists alpha_access_grants_active_idx
  on public.alpha_access_grants(enabled, expires_at);

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role = 'admin'
  )
$$;

create or replace function public.can_operate_content()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.profiles
    where id = (select auth.uid())
      and role in ('editor', 'rights_reviewer', 'admin')
  )
$$;

create or replace function public.alpha_flag_enabled(p_key text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select enabled from public.platform_runtime_flags where key = p_key),
    false
  )
$$;

create or replace function public.has_internal_alpha_access()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.is_staff()
    or (
      public.alpha_flag_enabled('internal_alpha_enabled')
      and (select auth.uid()) is not null
      and (
        not public.alpha_flag_enabled('internal_alpha_invite_only')
        or exists(
          select 1
          from public.alpha_access_grants g
          where g.user_id = (select auth.uid())
            and g.enabled
            and (g.expires_at is null or g.expires_at > now())
        )
      )
    )
$$;

create or replace function public.is_content_processing_allowed(p_content_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists(
    select 1
    from public.content_items c
    left join public.source_accounts s on s.id = c.source_account_id
    where c.id = p_content_id
      and c.status not in ('unavailable', 'removed')
      and c.disabled_at is null
      and (c.source_account_id is null or (
        s.is_enabled
        and s.approved_for_discovery
        and s.copyright_approved
      ))
      and public.has_publishable_rights(c.id, c.hosting_mode, c.access_level)
      and not exists(
        select 1
        from public.rights_records r
        where r.content_id = c.id
          and r.rights_hold
      )
  )
$$;

create or replace function public.is_content_effectively_available(p_content_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    public.has_internal_alpha_access()
    and exists(
      select 1
      from public.content_items c
      left join public.source_accounts s on s.id = c.source_account_id
      where c.id = p_content_id
        and c.status = 'published'
        and c.is_available
        and c.disabled_at is null
        and (c.publish_at is null or c.publish_at <= now())
        and (c.unpublish_at is null or c.unpublish_at > now())
        and (c.source_account_id is null or (
          s.is_enabled
          and s.approved_for_discovery
          and s.copyright_approved
          and s.disabled_at is null
        ))
        and public.has_publishable_rights(c.id, c.hosting_mode, c.access_level)
        and not exists(
          select 1
          from public.rights_records r
          where r.content_id = c.id
            and r.rights_hold
        )
        and (
          c.hosting_mode = 'text_database'
          or exists(
            select 1
            from public.playback_sources p
            where p.content_id = c.id
              and p.is_primary
              and p.status = 'active'
              and p.is_available
              and p.disabled_at is null
              and (
                c.hosting_mode not in ('self_host_open', 'self_host_owned')
                or exists(
                  select 1
                  from public.media_assets a
                  where a.id = p.media_asset_id
                    and a.status = 'ready'
                    and a.is_available
                    and a.disabled_at is null
                )
              )
          )
        )
    )
$$;

create or replace function public.set_content_availability(
  p_content_id uuid,
  p_enabled boolean,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item public.content_items;
  v_actor uuid := (select auth.uid());
begin
  if not public.can_operate_content() then
    raise exception 'content operator role required';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'availability reason is required';
  end if;

  select * into v_item
  from public.content_items
  where id = p_content_id
  for update;

  if v_item.id is null then
    raise exception 'content item not found';
  end if;

  if p_enabled then
    if v_item.status <> 'published' then
      raise exception 'content must be published before availability is enabled';
    end if;
    if not exists(
      select 1
      from public.content_items c
      left join public.source_accounts s on s.id = c.source_account_id
      where c.id = p_content_id
        and (c.source_account_id is null or (
          s.is_enabled
          and s.approved_for_discovery
          and s.copyright_approved
        ))
        and public.has_publishable_rights(c.id, c.hosting_mode, c.access_level)
        and not exists(
          select 1
          from public.rights_records r
          where r.content_id = c.id
            and r.rights_hold
        )
    ) then
      raise exception 'current rights and an enabled source are required';
    end if;
    if v_item.hosting_mode <> 'text_database' and not exists(
      select 1
      from public.playback_sources p
      where p.content_id = p_content_id
        and p.is_primary
        and p.status = 'active'
        and (
          v_item.hosting_mode not in ('self_host_open', 'self_host_owned')
          or exists(
            select 1
            from public.media_assets a
            where a.id = p.media_asset_id
              and a.status = 'ready'
          )
        )
    ) then
      raise exception 'ready primary playback is required';
    end if;

    update public.content_items
      set is_available = true,
          disabled_reason = null,
          disabled_at = null,
          disabled_by = null
      where id = p_content_id;
    update public.playback_sources
      set is_available = true,
          disabled_reason = null,
          disabled_at = null,
          disabled_by = null
      where content_id = p_content_id
        and is_primary
        and status = 'active';
    update public.media_assets
      set is_available = true,
          disabled_reason = null,
          disabled_at = null,
          disabled_by = null
      where content_id = p_content_id
        and status = 'ready';
  else
    update public.content_items
      set is_available = false,
          disabled_reason = p_reason,
          disabled_at = now(),
          disabled_by = v_actor
      where id = p_content_id;
    update public.playback_sources
      set is_available = false,
          disabled_reason = p_reason,
          disabled_at = now(),
          disabled_by = v_actor
      where content_id = p_content_id;
    update public.media_assets
      set is_available = false,
          disabled_reason = p_reason,
          disabled_at = now(),
          disabled_by = v_actor
      where content_id = p_content_id;
    update public.media_jobs j
      set cancel_requested = true,
          cancellation_reason = p_reason
      from public.media_assets a
      where j.media_asset_id = a.id
        and a.content_id = p_content_id
        and j.status in ('queued', 'processing');
    update public.source_download_jobs j
      set cancel_requested = true,
          cancellation_reason = p_reason
      from public.media_assets a
      where j.media_asset_id = a.id
        and a.content_id = p_content_id
        and j.status in ('queued', 'processing');
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(
    v_actor,
    case when p_enabled then 'content_availability_enabled' else 'content_availability_disabled' end,
    'content_item',
    p_content_id::text,
    jsonb_build_object('enabled', p_enabled, 'reason', p_reason)
  );
end
$$;

create or replace function public.set_source_availability(
  p_source_id uuid,
  p_enabled boolean,
  p_reason text
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_affected integer := 0;
begin
  if not public.is_rights_reviewer() then
    raise exception 'rights reviewer role required';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'availability reason is required';
  end if;
  if p_enabled and not exists(
    select 1
    from public.source_accounts
    where id = p_source_id
      and copyright_approved
      and approved_for_discovery
      and rights_evidence_url is not null
  ) then
    raise exception 'approved source evidence is required';
  end if;

  update public.source_accounts
    set is_enabled = p_enabled,
        disabled_reason = case when p_enabled then null else p_reason end,
        disabled_at = case when p_enabled then null else now() end,
        disabled_by = case when p_enabled then null else v_actor end,
        updated_at = now()
    where id = p_source_id;

  if not found then
    raise exception 'source account not found';
  end if;

  if not p_enabled then
    update public.content_items
      set is_available = false,
          disabled_reason = p_reason,
          disabled_at = now(),
          disabled_by = v_actor
      where source_account_id = p_source_id;
    get diagnostics v_affected = row_count;

    update public.playback_sources p
      set is_available = false,
          disabled_reason = p_reason,
          disabled_at = now(),
          disabled_by = v_actor
      from public.content_items c
      where p.content_id = c.id
        and c.source_account_id = p_source_id;

    update public.media_assets a
      set is_available = false,
          disabled_reason = p_reason,
          disabled_at = now(),
          disabled_by = v_actor
      from public.content_items c
      where a.content_id = c.id
        and c.source_account_id = p_source_id;

    update public.media_jobs j
      set cancel_requested = true,
          cancellation_reason = p_reason
      from public.media_assets a
      join public.content_items c on c.id = a.content_id
      where j.media_asset_id = a.id
        and c.source_account_id = p_source_id
        and j.status in ('queued', 'processing');
    update public.source_download_jobs j
      set cancel_requested = true,
          cancellation_reason = p_reason
      from public.media_assets a
      join public.content_items c on c.id = a.content_id
      where j.media_asset_id = a.id
        and c.source_account_id = p_source_id
        and j.status in ('queued', 'processing');
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(
    v_actor,
    case when p_enabled then 'source_availability_enabled' else 'source_availability_disabled' end,
    'source_account',
    p_source_id::text,
    jsonb_build_object('enabled', p_enabled, 'reason', p_reason, 'affected_content', v_affected)
  );

  return v_affected;
end
$$;

create or replace function public.set_rights_hold(
  p_content_id uuid,
  p_hold boolean,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if not public.is_rights_reviewer() then
    raise exception 'rights reviewer role required';
  end if;
  if p_hold and nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'rights-hold reason is required';
  end if;

  update public.rights_records
    set rights_hold = p_hold,
        rights_hold_reason = case when p_hold then p_reason else null end,
        rights_hold_at = case when p_hold then now() else null end,
        rights_hold_by = case when p_hold then v_actor else null end
    where content_id = p_content_id;

  if not found then
    raise exception 'rights record not found';
  end if;

  if p_hold then
    perform public.set_content_availability(p_content_id, false, p_reason);
  end if;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(
    v_actor,
    case when p_hold then 'rights_hold_applied' else 'rights_hold_released' end,
    'content_item',
    p_content_id::text,
    jsonb_build_object('hold', p_hold, 'reason', p_reason)
  );
end
$$;

create or replace function public.set_internal_alpha_state(
  p_enabled boolean,
  p_invite_only boolean,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if not public.is_admin() then
    raise exception 'admin role required';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'state-change reason is required';
  end if;
  if p_enabled then
    raise exception 'internal alpha activation requires the protected exact-SHA workflow';
  end if;
  if not p_invite_only then
    raise exception 'emergency Studio shutdown cannot relax invite-only access';
  end if;

  insert into public.platform_runtime_flags(key, enabled, notes, updated_by, updated_at)
  values
    ('internal_alpha_enabled', false, p_reason, v_actor, now()),
    ('internal_alpha_invite_only', true, p_reason, v_actor, now())
  on conflict(key) do update
    set enabled = excluded.enabled,
        notes = excluded.notes,
        updated_by = excluded.updated_by,
        updated_at = excluded.updated_at;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(
    v_actor,
    'internal_alpha_state_changed',
    'platform_runtime_flag',
    'internal_alpha',
    jsonb_build_object('enabled', false, 'invite_only', true, 'reason', p_reason, 'mode', 'emergency_studio_shutdown')
  );
end
$$;

create or replace function public.set_alpha_access_grant(
  p_user_id uuid,
  p_enabled boolean,
  p_expires_at timestamptz,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
begin
  if not public.is_admin() then
    raise exception 'admin role required';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'grant reason is required';
  end if;
  if p_enabled and p_expires_at is not null and p_expires_at <= now() then
    raise exception 'grant expiry must be in the future';
  end if;

  insert into public.alpha_access_grants(
    user_id, enabled, expires_at, granted_by, reason, granted_at,
    revoked_at, revoked_by, updated_at
  )
  values(
    p_user_id, p_enabled, p_expires_at,
    case when p_enabled then v_actor else null end,
    p_reason,
    case when p_enabled then now() else now() end,
    case when p_enabled then null else now() end,
    case when p_enabled then null else v_actor end,
    now()
  )
  on conflict(user_id) do update
    set enabled = excluded.enabled,
        expires_at = excluded.expires_at,
        granted_by = case when excluded.enabled then v_actor else public.alpha_access_grants.granted_by end,
        reason = excluded.reason,
        granted_at = case when excluded.enabled then now() else public.alpha_access_grants.granted_at end,
        revoked_at = case when excluded.enabled then null else now() end,
        revoked_by = case when excluded.enabled then null else v_actor end,
        updated_at = now();

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(
    v_actor,
    case when p_enabled then 'alpha_access_granted' else 'alpha_access_revoked' end,
    'user',
    p_user_id::text,
    jsonb_build_object('enabled', p_enabled, 'expires_at', p_expires_at, 'reason', p_reason)
  );
end
$$;

create or replace function public.review_source_item(
  p_source_item_id uuid,
  p_decision text,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_item public.source_items;
begin
  if not public.is_rights_reviewer() then
    raise exception 'rights reviewer role required';
  end if;
  if p_decision not in ('approve', 'reject', 'hold') then
    raise exception 'unsupported source-item decision';
  end if;
  if nullif(btrim(coalesce(p_reason, '')), '') is null then
    raise exception 'review reason is required';
  end if;

  select i.* into v_item
  from public.source_items i
  join public.source_accounts s on s.id = i.source_account_id
  where i.id = p_source_item_id
    and s.is_enabled
    and s.copyright_approved
    and s.approved_for_discovery
    and (s.next_review_at is null or s.next_review_at > now())
  for update of i;

  if v_item.id is null then
    raise exception 'source item or current approved source not found';
  end if;

  if p_decision = 'approve' then
    if nullif(btrim(coalesce(v_item.source_url, '')), '') is null
       or nullif(btrim(coalesce(v_item.title, '')), '') is null
       or nullif(btrim(coalesce(v_item.creator, '')), '') is null
       or nullif(btrim(coalesce(v_item.licence_code, '')), '') is null
       or nullif(btrim(coalesce(v_item.licence_url, '')), '') is null then
      raise exception 'complete item-level provenance is required before approval';
    end if;
    if lower(v_item.licence_code) ~ '(non.?commercial|(^|[-_ ])nc($|[-_ ])|no.?derivatives|(^|[-_ ])nd($|[-_ ])|all rights reserved)' then
      raise exception 'noncommercial, no-derivatives or reserved-rights items are rejected';
    end if;
  end if;

  update public.source_items
    set rights_state = case p_decision
      when 'approve' then 'validated'
      when 'reject' then 'rejected'
      else 'hold'
    end,
    ingestion_status = case p_decision
      when 'approve' then 'approved'
      when 'reject' then 'rejected'
      else 'reviewed'
    end,
    reviewed_at = now(),
    reviewed_by = v_actor,
    metadata = metadata || jsonb_build_object('review_reason', p_reason, 'review_decision', p_decision),
    updated_at = now()
  where id = p_source_item_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(
    v_actor,
    'source_item_' || p_decision,
    'source_item',
    p_source_item_id::text,
    jsonb_build_object('reason', p_reason)
  );
end
$$;

create or replace function public.promote_source_item_to_draft(
  p_source_item_id uuid,
  p_category_slug text default null,
  p_content_type public.content_type default 'video',
  p_hosting_mode public.hosting_mode default 'self_host_open'
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := (select auth.uid());
  v_item public.source_items;
  v_source public.source_accounts;
  v_category_id uuid;
  v_content_id uuid;
  v_asset_id uuid;
  v_slug text;
begin
  if not public.can_operate_content() then
    raise exception 'content operator role required';
  end if;
  if p_hosting_mode not in ('self_host_open', 'external_link', 'embed_only') then
    raise exception 'unsupported source-item hosting mode';
  end if;

  select i.* into v_item
  from public.source_items i
  join public.source_accounts s on s.id = i.source_account_id
  where i.id = p_source_item_id
    and i.rights_state = 'validated'
    and i.ingestion_status = 'approved'
    and i.content_id is null
    and s.is_enabled
    and s.copyright_approved
    and s.approved_for_discovery
    and (s.next_review_at is null or s.next_review_at > now())
  for update of i, s;

  if v_item.id is null then
    raise exception 'approved unimported source item not found';
  end if;

  select s.* into v_source
  from public.source_accounts s
  where s.id = v_item.source_account_id;

  if p_hosting_mode = 'self_host_open' then
    if lower(coalesce(v_item.media_type, '')) not in ('video', 'animation') then
      raise exception 'automatic self-hosted intake currently accepts video items only';
    end if;
    if nullif(btrim(coalesce(v_item.direct_media_url, '')), '') is null then
      raise exception 'a verified direct media URL is required for self-hosted intake';
    end if;
  end if;

  if p_category_slug is not null and p_category_slug <> '' then
    select id into v_category_id
    from public.categories
    where slug = p_category_slug and is_active;
    if v_category_id is null then
      raise exception 'active category not found';
    end if;
  end if;

  v_slug := trim(both '-' from regexp_replace(lower(v_item.title), '[^a-z0-9]+', '-', 'g'));
  v_slug := left(coalesce(nullif(v_slug, ''), 'open-content'), 52) || '-' || lower(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8));

  insert into public.content_items(
    slug, content_type, hosting_mode, access_level, status,
    title_en, description_en, primary_category_id, language,
    duration_seconds, thumbnail_url, source_account_id,
    is_available, created_by, updated_by
  ) values (
    v_slug, p_content_type, p_hosting_mode, 'internal_preview', 'draft',
    v_item.title, v_item.description, v_category_id,
    case when lower(coalesce(v_item.language, '')) in ('en','ur','roman_ur','multi') then lower(v_item.language) else 'multi' end,
    v_item.duration_seconds, v_item.thumbnail_url, v_item.source_account_id,
    false, v_actor, v_actor
  ) returning id into v_content_id;

  insert into public.rights_records(
    content_id, source_url, creator, licence_code, attribution_text,
    evidence_url, evidence_note, takedown_contact,
    commercial_use_confirmed, modification_confirmed,
    self_hosting_confirmed, embedding_confirmed, status
  ) values (
    v_content_id,
    v_item.source_url,
    v_item.creator,
    v_item.licence_code,
    concat_ws(' · ', nullif(v_item.creator, ''), nullif(v_item.title, ''), nullif(v_item.licence_code, '')),
    coalesce(nullif(v_item.licence_url, ''), v_source.rights_evidence_url),
    'Promoted from approved source candidate ' || v_item.id::text || '. Reconfirm hosting-mode permissions before approval.',
    'Jalwa rights operations',
    false, false, false, false, 'pending'
  );

  if p_hosting_mode = 'self_host_open' then
    v_asset_id := gen_random_uuid();
    insert into public.media_assets(
      id, content_id, kind, status, storage_key, mime_type,
      metadata, created_by, is_available
    ) values (
      v_asset_id,
      v_content_id,
      'source_video',
      'pending_upload',
      'incoming/' || v_content_id::text || '/' || v_asset_id::text || '/source.media',
      null,
      jsonb_build_object(
        'sourceItemId', v_item.id,
        'sourceUrl', v_item.source_url,
        'directMediaUrl', v_item.direct_media_url,
        'intake', 'rights_first_remote_download'
      ),
      v_actor,
      false
    );

    insert into public.source_download_jobs(source_item_id, media_asset_id)
    values(v_item.id, v_asset_id);
  end if;

  if p_hosting_mode = 'external_link' then
    insert into public.playback_sources(
      content_id, provider, external_url, is_primary, status, is_available
    ) values (
      v_content_id, 'other', v_item.source_url, true, 'active', false
    );
  end if;

  update public.source_items
    set content_id = v_content_id,
        ingestion_status = 'imported',
        updated_at = now()
  where id = p_source_item_id;

  insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
  values(
    v_actor,
    'source_item_promoted_to_draft',
    'content_item',
    v_content_id::text,
    jsonb_build_object('source_item_id', p_source_item_id, 'hosting_mode', p_hosting_mode, 'content_type', p_content_type)
  );

  return v_content_id;
end
$$;

create or replace function public.claim_source_download_job(p_worker_id text)
returns setof public.source_download_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.source_download_jobs;
begin
  select j.* into v_job
  from public.source_download_jobs j
  join public.media_assets a on a.id = j.media_asset_id
  join public.source_items i on i.id = j.source_item_id
  join public.source_accounts s on s.id = i.source_account_id
  where j.status = 'queued'
    and not j.cancel_requested
    and j.available_at <= now()
    and j.attempts < j.max_attempts
    and i.rights_state = 'validated'
    and i.ingestion_status = 'imported'
    and i.direct_media_url is not null
    and s.is_enabled
    and s.copyright_approved
    and s.approved_for_discovery
    and s.disabled_at is null
    and (s.next_review_at is null or s.next_review_at > now())
    and public.is_content_processing_allowed(a.content_id)
  order by j.created_at
  for update of j skip locked
  limit 1;

  if v_job.id is null then
    return;
  end if;

  update public.source_download_jobs
    set status = 'processing',
        locked_at = now(),
        locked_by = p_worker_id,
        attempts = attempts + 1,
        error_message = null,
        updated_at = now()
    where id = v_job.id
    returning * into v_job;

  return next v_job;
end
$$;

create or replace function public.complete_source_download_job(
  p_job_id uuid,
  p_size_bytes bigint,
  p_mime_type text,
  p_checksum text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.source_download_jobs;
  v_asset public.media_assets;
  v_content public.content_items;
  v_job_type public.media_job_type;
begin
  if p_size_bytes <= 0 then
    raise exception 'downloaded media size must be positive';
  end if;
  if p_mime_type not in ('video/mp4', 'video/quicktime', 'video/webm', 'video/x-matroska') then
    raise exception 'downloaded media MIME type is unsupported';
  end if;
  if p_checksum !~ '^[0-9a-f]{64}$' then
    raise exception 'downloaded media checksum is invalid';
  end if;

  select * into v_job
  from public.source_download_jobs
  where id = p_job_id
  for update;
  if v_job.id is null then
    raise exception 'source download job not found';
  end if;
  if v_job.status = 'completed' then
    return;
  end if;
  if v_job.status <> 'processing' or v_job.cancel_requested then
    raise exception 'source download job is not active';
  end if;

  select * into v_asset
  from public.media_assets
  where id = v_job.media_asset_id
  for update;
  if v_asset.id is null or not public.is_content_processing_allowed(v_asset.content_id) then
    raise exception 'source media is blocked by content or rights state';
  end if;

  select * into v_content
  from public.content_items
  where id = v_asset.content_id;
  if v_content.id is null then
    raise exception 'source content item not found';
  end if;

  v_job_type := case
    when v_content.content_type = 'short'
      or (v_content.duration_seconds is not null and v_content.duration_seconds <= 90)
    then 'short_mp4'::public.media_job_type
    else 'hls'::public.media_job_type
  end;

  update public.media_assets
    set status = 'queued',
        size_bytes = p_size_bytes,
        mime_type = p_mime_type,
        checksum = p_checksum,
        is_available = false,
        metadata = metadata || jsonb_build_object(
          'downloadCompletedAt', now(),
          'downloadChecksum', p_checksum
        )
    where id = v_asset.id;

  insert into public.media_jobs(media_asset_id, job_type, status)
  values(v_asset.id, v_job_type, 'queued')
  on conflict do nothing;

  update public.source_download_jobs
    set status = 'completed',
        completed_at = now(),
        locked_at = null,
        locked_by = null,
        error_message = null,
        updated_at = now()
    where id = p_job_id;
end
$$;

create or replace function public.fail_source_download_job(
  p_job_id uuid,
  p_error_message text
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.source_download_jobs;
  v_retry boolean;
begin
  select * into v_job
  from public.source_download_jobs
  where id = p_job_id
  for update;
  if v_job.id is null then
    raise exception 'source download job not found';
  end if;
  if v_job.status in ('completed', 'failed') then
    return false;
  end if;

  v_retry := not v_job.cancel_requested and v_job.attempts < v_job.max_attempts;
  update public.source_download_jobs
    set status = case when v_retry then 'queued' else 'failed' end,
        available_at = case when v_retry then now() + make_interval(secs => least(v_job.attempts * 60, 300)) else available_at end,
        locked_at = null,
        locked_by = null,
        completed_at = case when v_retry then null else now() end,
        error_message = left(coalesce(p_error_message, 'source download failed'), 4000),
        updated_at = now()
    where id = p_job_id;

  if not v_retry then
    update public.media_assets
      set status = 'failed',
          is_available = false,
          disabled_reason = left(coalesce(p_error_message, 'source download failed'), 4000),
          disabled_at = now()
      where id = v_job.media_asset_id;
  end if;

  return v_retry;
end
$$;

create or replace function public.mark_external_media_job_submitted(
  p_job_id uuid,
  p_provider_job_id text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.media_jobs
    set status = 'processing',
        locked_at = null,
        locked_by = null,
        error_message = null,
        output = output || jsonb_build_object(
          'provider', 'mediaconvert',
          'providerJobId', p_provider_job_id,
          'state', 'submitted'
        )
  where id = p_job_id
    and status = 'processing'
    and not cancel_requested;

  if not found then
    raise exception 'active external media job not found';
  end if;
end
$$;

create or replace function public.complete_external_media_job(
  p_job_id uuid,
  p_success boolean,
  p_media_path text,
  p_format text,
  p_provider_job_id text,
  p_error_message text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.media_jobs;
  v_asset public.media_assets;
  v_expected_prefix text;
begin
  select j.* into v_job
  from public.media_jobs j
  where j.id = p_job_id
  for update;

  if v_job.id is null then
    raise exception 'external media job not found';
  end if;

  select a.* into v_asset
  from public.media_assets a
  where a.id = v_job.media_asset_id
  for update;

  if v_asset.id is null then
    raise exception 'external media asset not found';
  end if;

  if v_job.status = 'completed' and v_job.output ->> 'providerJobId' = p_provider_job_id then
    return;
  end if;
  if v_job.status = 'failed' and not p_success then
    return;
  end if;
  if v_job.status not in ('queued', 'processing') then
    raise exception 'external media job is not active';
  end if;

  if not p_success then
    update public.media_jobs
      set status = 'failed',
          completed_at = now(),
          locked_at = null,
          locked_by = null,
          error_message = left(coalesce(p_error_message, 'MediaConvert job failed'), 4000),
          output = output || jsonb_build_object(
            'provider', 'mediaconvert',
            'providerJobId', p_provider_job_id,
            'state', 'failed'
          )
      where id = p_job_id;
    update public.media_assets
      set status = 'failed',
          is_available = false,
          disabled_reason = coalesce(p_error_message, 'MediaConvert job failed'),
          disabled_at = now()
      where id = v_asset.id;
    return;
  end if;

  if v_job.cancel_requested or not public.is_content_processing_allowed(v_asset.content_id) then
    update public.media_jobs
      set status = 'failed',
          completed_at = now(),
          error_message = 'Media output completed after cancellation or rights disablement.',
          output = output || jsonb_build_object('providerJobId', p_provider_job_id, 'state', 'blocked_after_completion')
      where id = p_job_id;
    update public.media_assets
      set status = 'failed', is_available = false
      where id = v_asset.id;
    return;
  end if;

  if p_format not in ('hls', 'mp4') then
    raise exception 'unsupported external media format';
  end if;
  if (v_job.job_type = 'hls' and p_format <> 'hls')
     or (v_job.job_type = 'short_mp4' and p_format <> 'mp4') then
    raise exception 'external media output format does not match job type';
  end if;

  v_expected_prefix := 'processed/' || v_asset.content_id::text || '/' || v_asset.id::text || '/';
  if p_media_path is null or p_media_path not like (v_expected_prefix || '%') or p_media_path like '%..%' then
    raise exception 'external media output path is outside the approved prefix';
  end if;

  update public.media_assets
    set status = 'ready',
        is_available = false,
        disabled_reason = null,
        disabled_at = null,
        disabled_by = null,
        metadata = metadata || jsonb_build_object(
          'mediaBackend', 'aws',
          'transcodeBackend', 'mediaconvert',
          'providerJobId', p_provider_job_id,
          'mediaPath', p_media_path
        )
    where id = v_asset.id;

  update public.playback_sources
    set is_primary = false,
        is_available = false
    where content_id = v_asset.content_id;

  update public.playback_sources
    set provider = 'original',
        media_url = p_media_path,
        format = p_format,
        is_primary = true,
        status = 'active',
        is_available = false,
        disabled_reason = null,
        disabled_at = null,
        disabled_by = null
    where media_asset_id = v_asset.id;

  if not found then
    insert into public.playback_sources(
      content_id, provider, media_asset_id, media_url, format,
      is_primary, status, is_available
    ) values (
      v_asset.content_id, 'original', v_asset.id, p_media_path, p_format,
      true, 'active', false
    );
  end if;

  update public.media_jobs
    set status = 'completed',
        completed_at = now(),
        locked_at = null,
        locked_by = null,
        error_message = null,
        output = output || jsonb_build_object(
          'provider', 'mediaconvert',
          'providerJobId', p_provider_job_id,
          'state', 'completed',
          'mediaPath', p_media_path,
          'format', p_format
        )
    where id = p_job_id;
end
$$;

create or replace function public.claim_media_job(p_worker_id text)
returns setof public.media_jobs
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_job public.media_jobs;
begin
  select j.* into v_job
  from public.media_jobs j
  join public.media_assets a on a.id = j.media_asset_id
  where j.status = 'queued'
    and not j.cancel_requested
    and j.available_at <= now()
    and j.attempts < j.max_attempts
    and public.is_content_processing_allowed(a.content_id)
  order by j.created_at
  for update of j skip locked
  limit 1;

  if v_job.id is null then
    return;
  end if;

  update public.media_jobs
    set status = 'processing',
        locked_at = now(),
        locked_by = p_worker_id,
        attempts = attempts + 1
    where id = v_job.id
    returning * into v_job;

  update public.media_assets
    set status = 'processing'
    where id = v_job.media_asset_id;

  return next v_job;
end
$$;

create or replace function public.search_catalogue(
  p_query text default null,
  p_category text default null,
  p_limit integer default 40
)
returns table(
  id uuid,
  slug text,
  title text,
  title_ur text,
  description text,
  category_slug text,
  category_name text,
  content_type public.content_type,
  hosting_mode public.hosting_mode,
  access_level public.access_level,
  duration_seconds integer,
  thumbnail_url text,
  published_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    c.slug,
    c.title_en,
    c.title_ur,
    c.description_en,
    cat.slug,
    cat.name_en,
    c.content_type,
    c.hosting_mode,
    c.access_level,
    c.duration_seconds,
    c.thumbnail_url,
    c.publish_at
  from public.content_items c
  left join public.categories cat on cat.id = c.primary_category_id
  where public.is_content_effectively_available(c.id)
    and (p_category is null or p_category = '' or cat.slug = p_category)
    and (
      p_query is null
      or p_query = ''
      or to_tsvector(
        'simple',
        coalesce(c.title_en, '') || ' ' ||
        coalesce(c.title_ur, '') || ' ' ||
        coalesce(c.title_roman_ur, '') || ' ' ||
        coalesce(c.description_en, '')
      ) @@ websearch_to_tsquery('simple', p_query)
      or extensions.similarity(c.title_en, p_query) > .2
    )
  order by c.is_featured desc, c.publish_at desc nulls last, c.created_at desc
  limit least(greatest(p_limit, 1), 100)
$$;

drop policy if exists "catalogue public" on public.content_items;
create policy "catalogue public" on public.content_items
for select using(
  public.is_staff()
  or public.is_content_effectively_available(id)
);

drop policy if exists "playback public" on public.playback_sources;
create policy "playback public" on public.playback_sources
for select using(
  public.is_staff()
  or public.is_content_effectively_available(content_id)
);

drop policy if exists "collections public" on public.collections;
create policy "collections public" on public.collections
for select using(
  public.is_staff()
  or (
    status = 'published'
    and public.has_internal_alpha_access()
  )
);

drop policy if exists "collection items public" on public.collection_items;
create policy "collection items public" on public.collection_items
for select using(
  public.is_staff()
  or (
    exists(
      select 1
      from public.collections c
      where c.id = collection_id
        and c.status = 'published'
    )
    and public.is_content_effectively_available(content_id)
  )
);

drop trigger if exists source_download_jobs_touch on public.source_download_jobs;
create trigger source_download_jobs_touch
before update on public.source_download_jobs
for each row execute procedure public.touch_updated_at();

alter table public.source_accounts enable row level security;
alter table public.source_items enable row level security;
alter table public.source_download_jobs enable row level security;
alter table public.platform_runtime_flags enable row level security;
alter table public.alpha_access_grants enable row level security;

drop policy if exists "staff source items read" on public.source_items;
create policy "staff source items read" on public.source_items
for select to authenticated using(public.is_staff());

drop policy if exists "staff source items update" on public.source_items;
drop policy if exists "reviewers source items update" on public.source_items;

drop policy if exists "staff source download jobs read" on public.source_download_jobs;
create policy "staff source download jobs read" on public.source_download_jobs
for select to authenticated using(public.is_staff());

drop policy if exists "staff source accounts read" on public.source_accounts;
create policy "staff source accounts read" on public.source_accounts
for select to authenticated using(public.is_staff());

drop policy if exists "reviewers source accounts update" on public.source_accounts;

drop policy if exists "staff runtime flags read" on public.platform_runtime_flags;
create policy "staff runtime flags read" on public.platform_runtime_flags
for select to authenticated using(public.is_staff());

drop policy if exists "admin runtime flags update" on public.platform_runtime_flags;

drop policy if exists "admin alpha grants" on public.alpha_access_grants;
drop policy if exists "admin alpha grants read" on public.alpha_access_grants;
create policy "admin alpha grants read" on public.alpha_access_grants
for select to authenticated
using(public.is_admin());

update public.content_items c
set is_available = true,
    disabled_reason = null,
    disabled_at = null,
    disabled_by = null
where c.status = 'published'
  and public.has_publishable_rights(c.id, c.hosting_mode, c.access_level);

update public.playback_sources p
set is_available = true,
    disabled_reason = null,
    disabled_at = null,
    disabled_by = null
where p.status = 'active'
  and exists(
    select 1
    from public.content_items c
    where c.id = p.content_id
      and c.is_available
  );

update public.media_assets a
set is_available = true,
    disabled_reason = null,
    disabled_at = null,
    disabled_by = null
where a.status = 'ready'
  and exists(
    select 1
    from public.content_items c
    where c.id = a.content_id
      and c.is_available
  );

revoke all on function public.is_admin() from public, anon;
revoke all on function public.can_operate_content() from public, anon;
revoke all on function public.is_content_processing_allowed(uuid) from public, anon;
revoke all on function public.set_content_availability(uuid, boolean, text) from public, anon;
revoke all on function public.set_source_availability(uuid, boolean, text) from public, anon;
revoke all on function public.set_rights_hold(uuid, boolean, text) from public, anon;
revoke all on function public.set_internal_alpha_state(boolean, boolean, text) from public, anon;
revoke all on function public.set_alpha_access_grant(uuid, boolean, timestamptz, text) from public, anon;
revoke all on function public.review_source_item(uuid, text, text) from public, anon;
revoke all on function public.promote_source_item_to_draft(uuid, text, public.content_type, public.hosting_mode) from public, anon;
revoke all on function public.claim_source_download_job(text) from public, anon, authenticated;
revoke all on function public.complete_source_download_job(uuid, bigint, text, text) from public, anon, authenticated;
revoke all on function public.fail_source_download_job(uuid, text) from public, anon, authenticated;
revoke all on function public.mark_external_media_job_submitted(uuid, text) from public, anon, authenticated;
revoke all on function public.complete_external_media_job(uuid, boolean, text, text, text, text) from public, anon, authenticated;
revoke all on function public.claim_media_job(text) from public, anon, authenticated;

grant execute on function public.is_admin() to authenticated;
grant execute on function public.can_operate_content() to authenticated;
grant execute on function public.alpha_flag_enabled(text) to anon, authenticated;
grant execute on function public.has_internal_alpha_access() to anon, authenticated;
grant execute on function public.is_content_processing_allowed(uuid) to authenticated, service_role;
grant execute on function public.is_content_effectively_available(uuid) to anon, authenticated;
grant execute on function public.set_content_availability(uuid, boolean, text) to authenticated;
grant execute on function public.set_source_availability(uuid, boolean, text) to authenticated;
grant execute on function public.set_rights_hold(uuid, boolean, text) to authenticated;
grant execute on function public.set_internal_alpha_state(boolean, boolean, text) to authenticated;
grant execute on function public.set_alpha_access_grant(uuid, boolean, timestamptz, text) to authenticated;
grant execute on function public.review_source_item(uuid, text, text) to authenticated;
grant execute on function public.promote_source_item_to_draft(uuid, text, public.content_type, public.hosting_mode) to authenticated;
grant execute on function public.claim_source_download_job(text) to service_role;
grant execute on function public.complete_source_download_job(uuid, bigint, text, text) to service_role;
grant execute on function public.fail_source_download_job(uuid, text) to service_role;
grant execute on function public.mark_external_media_job_submitted(uuid, text) to service_role;
grant execute on function public.complete_external_media_job(uuid, boolean, text, text, text, text) to service_role;
grant execute on function public.claim_media_job(text) to service_role;
grant select on public.source_download_jobs to authenticated;
grant all on public.source_download_jobs to service_role;
grant select on public.source_accounts to authenticated;
grant select on public.source_items to authenticated;
grant all on public.source_items to service_role;
grant select on public.platform_runtime_flags to authenticated;
grant select on public.alpha_access_grants to authenticated;

commit;
