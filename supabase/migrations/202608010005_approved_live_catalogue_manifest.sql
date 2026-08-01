-- A single fail-closed manifest replaces duplicated hard-coded inventory lists
-- in operational scripts. Collection children are marked non-user-facing; the
-- two published USGS collections account for the remaining user-facing cards.

begin;

create table if not exists public.approved_live_catalogue_manifest (
  source_key text primary key,
  slug text not null unique,
  user_facing_entry boolean not null default true,
  approved_batch text not null,
  created_at timestamptz not null default now()
);

alter table public.approved_live_catalogue_manifest enable row level security;
revoke all on public.approved_live_catalogue_manifest from anon, authenticated;
grant select,insert,update,delete on public.approved_live_catalogue_manifest to service_role;

insert into public.approved_live_catalogue_manifest(source_key,slug,user_facing_entry,approved_batch) values
('nasa-space-station-views','nasa-space-station-views',true,'initial-public-domain'),
('noaa-ocean-camera-1','noaa-ocean-exploration-camera-1',true,'initial-public-domain'),
('noaa-ocean-camera-2','noaa-ocean-exploration-camera-2',true,'initial-public-domain'),
('noaa-ocean-camera-3','noaa-ocean-exploration-camera-3',true,'initial-public-domain'),
('usgs-kilauea-v1','usgs-kilauea-v1',true,'initial-public-domain'),
('usgs-kilauea-v2','usgs-kilauea-v2',true,'initial-public-domain'),
('usgs-kilauea-v3','usgs-kilauea-v3',true,'initial-public-domain'),
('usgs-mauna-loa-mlcam','usgs-mauna-loa-mlcam',false,'initial-public-domain'),
('usgs-mauna-loa-mtcam','usgs-mauna-loa-mtcam',false,'initial-public-domain'),
('usgs-mauna-loa-mk2cam','usgs-mauna-loa-mk2cam',false,'initial-public-domain'),
('usgs-mauna-loa-mkcam','usgs-mauna-loa-mkcam',false,'initial-public-domain'),
('usgs-river-pequest','usgs-river-pequest',false,'initial-public-domain'),
('usgs-river-delaware-belvidere','usgs-river-delaware-belvidere',false,'initial-public-domain'),
('usgs-lake-hopatcong','usgs-lake-hopatcong',false,'initial-public-domain'),
('usgs-river-rancocas','usgs-river-rancocas',false,'initial-public-domain'),
('european-parliament-plenary','european-parliament-plenary',true,'institutional-link'),
('european-parliament-committee-rooms','european-parliament-committee-rooms',true,'institutional-link'),
('un-web-tv','un-web-tv',true,'institutional-link'),
('un-general-assembly','un-general-assembly',true,'institutional-link'),
('un-security-council','un-security-council',true,'institutional-link'),
('un-human-rights-council','un-human-rights-council',true,'institutional-link'),
('dvids-live-webcasts','dvids-live-webcasts',true,'open-government'),
('dvids-pentagon-press-briefings','dvids-pentagon-press-briefings',true,'open-government'),
('dvids-white-house-public-events','dvids-white-house-public-events',true,'open-government'),
('dvids-navy-recruit-graduations','dvids-navy-recruit-graduations',true,'open-government'),
('dvids-defense-conferences-ceremonies','dvids-defense-conferences-ceremonies',true,'open-government'),
('nasa-plus-live-events','nasa-plus-live-events',true,'open-government'),
('nasa-mission-launch-coverage','nasa-mission-launch-coverage',true,'open-government'),
('nasa-space-to-ground','nasa-space-to-ground',true,'open-government'),
('nps-devils-tower-entrance','nps-devils-tower-entrance',true,'open-government'),
('nps-mount-rainier-sunrise','nps-mount-rainier-sunrise',true,'open-government'),
('nps-mount-rainier-paradise','nps-mount-rainier-paradise',true,'open-government'),
('nps-mount-rainier-tatoosh','nps-mount-rainier-tatoosh',true,'open-government'),
('nps-guadalupe-pine-springs','nps-guadalupe-pine-springs',true,'open-government'),
('nps-guadalupe-el-capitan','nps-guadalupe-el-capitan',true,'open-government'),
('nps-shenandoah-mountain-view','nps-shenandoah-mountain-view',true,'open-government'),
('nps-shenandoah-big-meadows','nps-shenandoah-big-meadows',true,'open-government'),
('nps-smokies-newfound-gap','nps-smokies-newfound-gap',true,'open-government'),
('nps-point-reyes-beach','nps-point-reyes-beach',true,'open-government'),
('nps-yellowstone-electric-peak','nps-yellowstone-electric-peak',true,'open-government'),
('nps-glacier-night-sky','nps-glacier-night-sky',true,'open-government'),
('nps-bunker-hill-west','nps-bunker-hill-west',true,'open-government'),
('nps-painted-desert-inn','nps-painted-desert-inn',true,'open-government'),
('nps-el-morro','nps-el-morro',true,'open-government'),
('nih-videocast','nih-videocast',true,'open-government'),
('fda-advisory-committee-live','fda-advisory-committee-live',true,'open-government'),
('sec-public-meetings','sec-public-meetings',true,'open-government'),
('fcc-open-meetings','fcc-open-meetings',true,'open-government'),
('europe-by-satellite-ebs','europe-by-satellite-ebs',true,'open-government'),
('europe-by-satellite-ebs-plus','europe-by-satellite-ebs-plus',true,'open-government'),
('us-house-floorcast','us-house-floorcast',true,'open-government'),
('us-senate-floor-webcast','us-senate-floor-webcast',true,'open-government')
on conflict(source_key) do update set
  slug=excluded.slug,
  user_facing_entry=excluded.user_facing_entry,
  approved_batch=excluded.approved_batch;

do $$
declare
  v_total integer;
  v_direct integer;
begin
  select count(*) into v_total from public.approved_live_catalogue_manifest;
  select count(*) into v_direct from public.approved_live_catalogue_manifest where user_facing_entry;
  if v_total <> 52 then raise exception 'Approved live manifest must contain 52 underlying sources'; end if;
  if v_direct <> 44 then raise exception 'Approved live manifest must contain 44 direct user-facing entries'; end if;
end $$;

commit;
