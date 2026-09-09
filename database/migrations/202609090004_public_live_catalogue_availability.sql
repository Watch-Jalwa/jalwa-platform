begin;

-- Public live catalogue availability hardening.
-- The approved live inventory predates the internal-alpha availability columns,
-- which were introduced fail-closed. Re-enable only manifest-backed live items
-- that still satisfy publication, rights, source and live-config governance.

create or replace function public.is_content_effectively_available(p_content_id uuid)
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
      and c.status = 'published'
      and c.is_available
      and c.disabled_at is null
      and (c.publish_at is null or c.publish_at <= now())
      and (c.unpublish_at is null or c.unpublish_at > now())
      and (
        c.source_account_id is null
        or (
          s.is_enabled
          and s.approved_for_discovery
          and s.copyright_approved
          and s.disabled_at is null
        )
      )
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
              or (
                c.content_type = 'live'
                and exists(
                  select 1
                  from public.live_source_configs l
                  join public.approved_live_catalogue_manifest m
                    on m.source_key = l.source_key
                   and m.slug = c.slug
                  where l.playback_source_id = p.id
                    and l.enabled
                    and l.rights_verified_at is not null
                    and l.next_review_at > now()
                    and l.delivery_adapter = 'public_domain_live_image'
                    and l.expected_media_type = 'current_image'
                )
              )
            )
        )
      )
  )
$$;

update public.content_items c
set is_available = true,
    updated_at = now()
where c.id in (
  select c2.id
  from public.approved_live_catalogue_manifest m
  join public.content_items c2 on c2.slug = m.slug
  join public.playback_sources p on p.content_id = c2.id and p.is_primary
  join public.live_source_configs l on l.playback_source_id = p.id and l.source_key = m.source_key
  left join public.source_accounts s on s.id = c2.source_account_id
  where c2.content_type = 'live'
    and c2.status = 'published'
    and c2.disabled_at is null
    and p.status = 'active'
    and p.disabled_at is null
    and l.enabled
    and l.rights_verified_at is not null
    and l.next_review_at > now()
    and (
      c2.source_account_id is null
      or (
        s.is_enabled
        and s.approved_for_discovery
        and s.copyright_approved
        and s.disabled_at is null
      )
    )
    and public.has_publishable_rights(c2.id, c2.hosting_mode, c2.access_level)
    and not exists(
      select 1
      from public.rights_records r
      where r.content_id = c2.id
        and r.rights_hold
    )
);

update public.playback_sources p
set is_available = true
where p.id in (
  select p2.id
  from public.approved_live_catalogue_manifest m
  join public.content_items c on c.slug = m.slug
  join public.playback_sources p2 on p2.content_id = c.id and p2.is_primary
  join public.live_source_configs l on l.playback_source_id = p2.id and l.source_key = m.source_key
  where c.is_available
    and c.disabled_at is null
    and p2.status = 'active'
    and p2.disabled_at is null
    and l.enabled
    and l.rights_verified_at is not null
    and l.next_review_at > now()
);

update public.media_assets a
set is_available = true
where a.status = 'ready'
  and a.disabled_at is null
  and a.content_id in (
    select c.id
    from public.approved_live_catalogue_manifest m
    join public.content_items c on c.slug = m.slug
    where c.is_available
  );

do $$
declare
  v_manifest integer;
  v_available integer;
begin
  select count(*) into v_manifest
  from public.approved_live_catalogue_manifest;

  select count(*) into v_available
  from public.approved_live_catalogue_manifest m
  join public.content_items c on c.slug = m.slug
  where public.is_content_effectively_available(c.id);

  if v_manifest <> 52 then
    raise exception 'Approved live manifest must contain 52 underlying sources';
  end if;
  if v_available <> v_manifest then
    raise exception 'Approved live catalogue availability is incomplete: % of % items are public', v_available, v_manifest;
  end if;
end $$;

comment on function public.is_content_effectively_available(uuid) is
  'True only for published, enabled, rights-valid content with usable playback. Approved public-domain live-image adapters may use their reviewed remote proxy instead of a stored media asset.';

commit;
