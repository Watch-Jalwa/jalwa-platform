\set ON_ERROR_STOP on

-- Public-domain live source fixtures may run only in staging. The approved
-- inventory is now installed by the forward-only database migration; this
-- compatibility script verifies that state and performs no inserts or updates.
select set_config('jalwa.deployment_environment', :'deployment_environment', false);

do $$
declare
  v_items integer;
  v_configs integer;
  v_rights integer;
  v_images integer;
begin
  if current_setting('jalwa.deployment_environment', true) <> 'staging' then
    raise exception 'Public-domain live source fixtures may run only in staging';
  end if;

  select count(*) into v_items
  from public.content_items
  where slug in (
    'nasa-space-station-views',
    'noaa-ocean-exploration-camera-1','noaa-ocean-exploration-camera-2','noaa-ocean-exploration-camera-3',
    'usgs-kilauea-v1','usgs-kilauea-v2','usgs-kilauea-v3',
    'usgs-mauna-loa-mlcam','usgs-mauna-loa-mtcam','usgs-mauna-loa-mk2cam','usgs-mauna-loa-mkcam',
    'usgs-river-pequest','usgs-river-delaware-belvidere','usgs-lake-hopatcong','usgs-river-rancocas'
  );

  select count(*) into v_configs
  from public.live_source_configs
  where source_key in (
    'nasa-space-station-views',
    'noaa-ocean-camera-1','noaa-ocean-camera-2','noaa-ocean-camera-3',
    'usgs-kilauea-v1','usgs-kilauea-v2','usgs-kilauea-v3',
    'usgs-mauna-loa-mlcam','usgs-mauna-loa-mtcam','usgs-mauna-loa-mk2cam','usgs-mauna-loa-mkcam',
    'usgs-river-pequest','usgs-river-delaware-belvidere','usgs-lake-hopatcong','usgs-river-rancocas'
  ) and rights_verified_at=timestamptz '2026-08-01 09:51:00+00'
    and next_review_at=timestamptz '2026-10-30 09:51:00+00';

  select count(*) into v_rights
  from public.rights_records r
  join public.content_items c on c.id=r.content_id
  where c.slug in (
    'nasa-space-station-views',
    'noaa-ocean-exploration-camera-1','noaa-ocean-exploration-camera-2','noaa-ocean-exploration-camera-3',
    'usgs-kilauea-v1','usgs-kilauea-v2','usgs-kilauea-v3',
    'usgs-mauna-loa-mlcam','usgs-mauna-loa-mtcam','usgs-mauna-loa-mk2cam','usgs-mauna-loa-mkcam',
    'usgs-river-pequest','usgs-river-delaware-belvidere','usgs-lake-hopatcong','usgs-river-rancocas'
  ) and r.status='approved'
    and r.verified_at=timestamptz '2026-08-01 09:51:00+00';

  select count(*) into v_images
  from public.content_items
  where slug in (
    'usgs-mauna-loa-mlcam','usgs-mauna-loa-mtcam','usgs-mauna-loa-mk2cam','usgs-mauna-loa-mkcam',
    'usgs-river-pequest','usgs-river-delaware-belvidere','usgs-lake-hopatcong','usgs-river-rancocas'
  ) and hosting_mode='self_host_open';

  if v_items <> 15 then raise exception 'Approved live inventory is incomplete'; end if;
  if v_configs <> 15 then raise exception 'Approved live source review metadata is incomplete'; end if;
  if v_rights <> 15 then raise exception 'Approved live rights records are incomplete'; end if;
  if v_images <> 8 then raise exception 'USGS image hosting modes are incorrect'; end if;
end $$;

select jsonb_build_object(
  'content_items',15,
  'source_configs',15,
  'approved_rights',15,
  'collections',2,
  'rights_review_expires_at','2026-10-30T09:51:00Z'
) as public_domain_live_seed_summary;
