begin;

-- Keep self-hosted publication fail-closed while recognizing the reviewed
-- manifest-backed public-domain live-image delivery path. Ordinary self-hosted
-- media still requires a ready, available stored media asset.
create or replace function public.enforce_self_hosted_publish_ready()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'published'
    and new.hosting_mode in ('self_host_open', 'self_host_owned')
    and old.status is distinct from 'published'
    and not exists (
      select 1
      from public.playback_sources p
      where p.content_id = new.id
        and p.is_primary
        and p.status = 'active'
        and p.is_available
        and p.disabled_at is null
        and (
          exists (
            select 1
            from public.media_assets a
            where a.id = p.media_asset_id
              and a.status = 'ready'
              and a.is_available
              and a.disabled_at is null
          )
          or (
            new.content_type = 'live'
            and exists (
              select 1
              from public.live_source_configs l
              join public.approved_live_catalogue_manifest m
                on m.source_key = l.source_key
               and m.slug = new.slug
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
  then
    raise exception 'ready self-hosted playback source required before publishing';
  end if;

  return new;
end
$$;

comment on function public.enforce_self_hosted_publish_ready() is
  'Prevents self-hosted publication without an available primary playback path. Stored self-hosted media requires a ready available asset; reviewed manifest-backed public-domain live-image adapters may use their governed remote proxy.';

commit;
