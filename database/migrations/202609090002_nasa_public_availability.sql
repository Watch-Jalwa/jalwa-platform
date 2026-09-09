begin;

do $repair$
declare
  v_content_id uuid;
  v_source_id uuid;
begin
  select id
    into v_source_id
  from public.source_accounts
  where source_key = 'NA-013'
    and provider = 'nasa'
    and is_enabled
    and approved_for_discovery
    and copyright_approved
    and disabled_at is null;

  if v_source_id is null then
    raise exception 'Approved NASA ISS source account NA-013 is unavailable';
  end if;

  select id
    into v_content_id
  from public.content_items
  where slug = 'nasa-space-station-views'
  for update;

  if v_content_id is null then
    return;
  end if;

  if exists (
    select 1
    from public.content_items c
    where c.id = v_content_id
      and c.disabled_at is not null
  ) then
    raise exception 'NASA ISS content is explicitly disabled; refusing to override governance';
  end if;

  if not exists (
    select 1
    from public.rights_records r
    where r.content_id = v_content_id
      and r.status = 'approved'
      and coalesce(r.rights_hold, false) = false
  ) then
    raise exception 'NASA ISS content does not have approved publishable rights';
  end if;

  if not exists (
    select 1
    from public.playback_sources p
    where p.content_id = v_content_id
      and p.is_primary
      and p.status = 'active'
      and p.disabled_at is null
  ) then
    raise exception 'NASA ISS content does not have an active primary playback source';
  end if;

  update public.content_items
  set source_account_id = v_source_id,
      is_available = true,
      updated_at = now()
  where id = v_content_id;

  update public.playback_sources
  set is_available = true,
      disabled_reason = null,
      disabled_at = null,
      disabled_by = null
  where content_id = v_content_id
    and is_primary
    and status = 'active'
    and disabled_at is null;
end
$repair$;

commit;
