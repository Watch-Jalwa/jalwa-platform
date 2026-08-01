\set ON_ERROR_STOP on

-- Approved live source fixtures may run only in staging. The inventory is
-- installed by forward-only migrations; this compatibility script verifies
-- all twenty-one underlying records that make up fifteen user-facing entries.
select set_config('jalwa.deployment_environment', :'deployment_environment', false);

do $$
declare
  v_items integer;
  v_configs integer;
  v_rights integer;
  v_images integer;
  v_links integer;
begin
  if current_setting('jalwa.deployment_environment', true) <> 'staging' then
    raise exception 'Approved live source fixtures may run only in staging';
  end if;

  select count(*) into v_items
  from public.content_items
  where slug in (
    'nasa-space-station-views',
    'noaa-ocean-exploration-camera-1','noaa-ocean-exploration-camera-2','noaa-ocean-exploration-camera-3',
    'usgs-kilauea-v1','usgs-kilauea-v2','usgs-kilauea-v3',
    'usgs-mauna-loa-mlcam','usgs-mauna-loa-mtcam','usgs-mauna-loa-mk2cam','usgs-mauna-loa-mkcam',
    'usgs-river-pequest','usgs-river-delaware-belvidere','usgs-lake-hopatcong','usgs-river-rancocas',
    'european-parliament-plenary','european-parliament-committee-rooms','un-web-tv',
    'un-general-assembly','un-security-council','un-human-rights-council'
  );

  select count(*) into v_configs
  from public.live_source_configs
  where source_key in (
    'nasa-space-station-views',
    'noaa-ocean-camera-1','noaa-ocean-camera-2','noaa-ocean-camera-3',
    'usgs-kilauea-v1','usgs-kilauea-v2','usgs-kilauea-v3',
    'usgs-mauna-loa-mlcam','usgs-mauna-loa-mtcam','usgs-mauna-loa-mk2cam','usgs-mauna-loa-mkcam',
    'usgs-river-pequest','usgs-river-delaware-belvidere','usgs-lake-hopatcong','usgs-river-rancocas',
    'european-parliament-plenary','european-parliament-committee-rooms','un-web-tv',
    'un-general-assembly','un-security-council','un-human-rights-council'
  ) and rights_verified_at is not null
    and next_review_at >= timestamptz '2026-10-30 09:51:00+00';

  select count(*) into v_rights
  from public.rights_records r
  join public.content_items c on c.id=r.content_id
  where c.slug in (
    'nasa-space-station-views',
    'noaa-ocean-exploration-camera-1','noaa-ocean-exploration-camera-2','noaa-ocean-exploration-camera-3',
    'usgs-kilauea-v1','usgs-kilauea-v2','usgs-kilauea-v3',
    'usgs-mauna-loa-mlcam','usgs-mauna-loa-mtcam','usgs-mauna-loa-mk2cam','usgs-mauna-loa-mkcam',
    'usgs-river-pequest','usgs-river-delaware-belvidere','usgs-lake-hopatcong','usgs-river-rancocas',
    'european-parliament-plenary','european-parliament-committee-rooms','un-web-tv',
    'un-general-assembly','un-security-council','un-human-rights-council'
  ) and r.status='approved';

  select count(*) into v_images
  from public.content_items
  where slug in (
    'usgs-mauna-loa-mlcam','usgs-mauna-loa-mtcam','usgs-mauna-loa-mk2cam','usgs-mauna-loa-mkcam',
    'usgs-river-pequest','usgs-river-delaware-belvidere','usgs-lake-hopatcong','usgs-river-rancocas'
  ) and hosting_mode='self_host_open';

  select count(*) into v_links
  from public.content_items c
  join public.playback_sources p on p.content_id=c.id and p.is_primary
  join public.live_source_configs l on l.playback_source_id=p.id
  where c.slug in (
    'european-parliament-plenary','european-parliament-committee-rooms','un-web-tv',
    'un-general-assembly','un-security-council','un-human-rights-council'
  ) and c.hosting_mode='external_link'
    and l.delivery_adapter='official_live_link'
    and l.expected_media_type='official_link';

  if v_items <> 21 then raise exception 'Approved live inventory is incomplete'; end if;
  if v_configs <> 21 then raise exception 'Approved live source review metadata is incomplete'; end if;
  if v_rights <> 21 then raise exception 'Approved live rights records are incomplete'; end if;
  if v_images <> 8 then raise exception 'USGS image hosting modes are incorrect'; end if;
  if v_links <> 6 then raise exception 'Institutional live entries must remain official-link only'; end if;
end $$;

select jsonb_build_object(
  'user_facing_entries',15,
  'content_items',21,
  'source_configs',21,
  'approved_rights',21,
  'official_link_entries',6,
  'collections',2,
  'earliest_rights_review_expires_at','2026-10-30T09:51:00Z'
) as approved_live_seed_summary;
