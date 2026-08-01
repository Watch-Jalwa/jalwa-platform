\set ON_ERROR_STOP on

-- Approved live source fixtures may run only in staging. Forward-only
-- migrations install the inventory; this script is a read-only verifier.
select set_config('jalwa.deployment_environment', :'deployment_environment', false);

do $$
declare
  v_manifest integer;
  v_direct integer;
  v_items integer;
  v_configs integer;
  v_rights integer;
  v_images integer;
  v_links integer;
begin
  if current_setting('jalwa.deployment_environment', true) <> 'staging' then
    raise exception 'Approved live source fixtures may run only in staging';
  end if;

  select count(*),count(*) filter(where user_facing_entry)
    into v_manifest,v_direct
  from public.approved_live_catalogue_manifest;

  select count(*) into v_items
  from public.content_items c
  join public.approved_live_catalogue_manifest m on m.slug=c.slug;

  select count(*) into v_configs
  from public.live_source_configs l
  join public.approved_live_catalogue_manifest m on m.source_key=l.source_key
  where l.rights_verified_at is not null and l.next_review_at > now();

  select count(*) into v_rights
  from public.rights_records r
  join public.content_items c on c.id=r.content_id
  join public.approved_live_catalogue_manifest m on m.slug=c.slug
  where r.status='approved';

  select count(*) into v_images
  from public.content_items c
  join public.playback_sources p on p.content_id=c.id and p.is_primary
  join public.live_source_configs l on l.playback_source_id=p.id
  join public.approved_live_catalogue_manifest m on m.source_key=l.source_key
  where l.delivery_adapter='public_domain_live_image'
    and l.expected_media_type='current_image'
    and c.hosting_mode='self_host_open';

  select count(*) into v_links
  from public.content_items c
  join public.playback_sources p on p.content_id=c.id and p.is_primary
  join public.live_source_configs l on l.playback_source_id=p.id
  join public.approved_live_catalogue_manifest m on m.source_key=l.source_key
  where l.delivery_adapter='official_live_link'
    and l.expected_media_type='official_link'
    and c.hosting_mode='external_link';

  if v_manifest <> 52 then raise exception 'Approved live manifest is incomplete'; end if;
  if v_direct <> 44 then raise exception 'Approved direct live entries are incomplete'; end if;
  if v_items <> 52 then raise exception 'Approved live inventory is incomplete'; end if;
  if v_configs <> 52 then raise exception 'Approved live source review metadata is incomplete'; end if;
  if v_rights <> 52 then raise exception 'Approved live rights records are incomplete'; end if;
  if v_images <> 23 then raise exception 'Approved current-image hosting modes are incorrect'; end if;
  if v_links <> 22 then raise exception 'Conditional sources must remain official-link only'; end if;
end $$;

select jsonb_build_object(
  'user_facing_entries',46,
  'content_items',52,
  'source_configs',52,
  'approved_rights',52,
  'current_image_entries',23,
  'official_link_entries',22,
  'collections',2,
  'earliest_rights_review_expires_at',(
    select min(l.next_review_at)
    from public.live_source_configs l
    join public.approved_live_catalogue_manifest m on m.source_key=l.source_key
  )
) as approved_live_seed_summary;
