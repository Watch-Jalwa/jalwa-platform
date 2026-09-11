begin;

-- Forward correction for public live catalogue availability.
-- 202609090004 was briefly applied to staging with an earlier checksum before
-- its clean-bootstrap-safe form was finalized. Keep activation environment-bound
-- and reapply the corrected predicate here so reconciled staging and fresh installs
-- converge on the same schema behavior.

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
        c.content_type <> 'live'
        or exists(
          select 1
          from public.playback_sources lp
          join public.live_source_configs l on l.playback_source_id = lp.id
          join public.approved_live_catalogue_manifest m
            on m.source_key = l.source_key
           and m.slug = c.slug
          where lp.content_id = c.id
            and lp.is_primary
            and lp.status = 'active'
            and lp.is_available
            and lp.disabled_at is null
            and l.enabled
            and l.rights_verified_at is not null
            and l.next_review_at > now()
        )
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

do $$
declare
  v_manifest integer;
begin
  select count(*) into v_manifest from public.approved_live_catalogue_manifest;
  if v_manifest <> 52 then
    raise exception 'Approved live manifest must contain 52 underlying sources';
  end if;
end $$;

comment on function public.is_content_effectively_available(uuid) is
  'True only for published, enabled, rights-valid content with usable playback. Live content also requires a current reviewed manifest-backed live-source config; approved public-domain live-image adapters may use their reviewed remote proxy instead of a stored media asset.';

commit;
