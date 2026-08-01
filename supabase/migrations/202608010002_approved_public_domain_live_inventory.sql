begin;

-- Owner approval was recorded on 1 August 2026 after review of the official
-- NASA, NOAA Ocean Exploration and USGS source/usage pages. This migration
-- installs the exact approved inventory in every environment while preserving
-- a separate, default-off operational enablement gate.

create temporary table approved_live_inventory (
  source_key text primary key,
  slug text not null,
  title text not null,
  title_ur text,
  description text not null,
  provider text not null,
  adapter public.live_delivery_adapter not null,
  hosting_mode public.hosting_mode not null,
  source_url text not null,
  terms_url text not null,
  attribution text not null,
  allowed_hosts text[] not null,
  refresh_seconds integer not null,
  freshness_seconds integer not null,
  off_air_allowed boolean not null default false,
  collection_slug text
);

insert into approved_live_inventory values
('nasa-space-station-views','nasa-space-station-views','NASA Space Station Views','ناسا خلائی اسٹیشن کے براہ راست مناظر','Live views from the International Space Station with mission audio when available.','nasa','official_live_embed','embed_only','https://www.nasa.gov/live/','https://www.nasa.gov/nasa-brand-center/images-and-media/','Source: NASA. NASA does not endorse Jalwa or its advertisers.',array['www.nasa.gov','www.youtube.com','www.youtube-nocookie.com','youtube.com'],900,86400,false,null),
('noaa-ocean-camera-1','noaa-ocean-exploration-camera-1','NOAA Ocean Exploration Camera 1','نوآ سمندری تحقیق کیمرا 1','Official NOAA Ocean Exploration live video. Audio is generally available during dives.','noaa','official_live_embed','embed_only','https://oceanexplorer.noaa.gov/livestreams/','https://oceanexplorer.noaa.gov/about/media-kit/','Courtesy of NOAA Ocean Exploration.',array['oceanexplorer.noaa.gov','www.youtube.com','www.youtube-nocookie.com','youtube.com'],300,3600,true,null),
('noaa-ocean-camera-2','noaa-ocean-exploration-camera-2','NOAA Ocean Exploration Camera 2','نوآ سمندری تحقیق کیمرا 2','Official NOAA Ocean Exploration secondary live camera.','noaa','official_live_embed','embed_only','https://oceanexplorer.noaa.gov/livestreams/','https://oceanexplorer.noaa.gov/about/media-kit/','Courtesy of NOAA Ocean Exploration.',array['oceanexplorer.noaa.gov','www.youtube.com','www.youtube-nocookie.com','youtube.com'],300,3600,true,null),
('noaa-ocean-camera-3','noaa-ocean-exploration-camera-3','NOAA Ocean Exploration Camera 3','نوآ سمندری تحقیق کیمرا 3','Official NOAA Ocean Exploration live video. Audio is generally available during dives.','noaa','official_live_embed','embed_only','https://oceanexplorer.noaa.gov/livestreams/','https://oceanexplorer.noaa.gov/about/media-kit/','Courtesy of NOAA Ocean Exploration.',array['oceanexplorer.noaa.gov','www.youtube.com','www.youtube-nocookie.com','youtube.com'],300,3600,true,null),
('usgs-kilauea-v1','usgs-kilauea-v1','USGS Kīlauea V1','یو ایس جی ایس کیلاؤیا V1','Live western view of Halemaʻumaʻu crater from the Kīlauea summit.','usgs','official_live_embed','embed_only','https://www.usgs.gov/volcanoes/kilauea/v1cam-kilauea-volcano-hawaii-west-halemaumau-crater','https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits','Source: U.S. Geological Survey. Public domain.',array['www.usgs.gov','url.usgs.gov','www.youtube.com','www.youtube-nocookie.com','youtube.com'],900,86400,false,null),
('usgs-kilauea-v2','usgs-kilauea-v2','USGS Kīlauea V2','یو ایس جی ایس کیلاؤیا V2','Live eastern view of Halemaʻumaʻu crater from the Kīlauea summit.','usgs','official_live_embed','embed_only','https://www.usgs.gov/media/webcams/v2cam-kilauea-volcano-hawaii-east-halemaumau-crater','https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits','Source: U.S. Geological Survey. Public domain.',array['www.usgs.gov','url.usgs.gov','www.youtube.com','www.youtube-nocookie.com','youtube.com'],900,86400,false,null),
('usgs-kilauea-v3','usgs-kilauea-v3','USGS Kīlauea V3','یو ایس جی ایس کیلاؤیا V3','Live southern view of Halemaʻumaʻu crater from the Kīlauea summit.','usgs','official_live_embed','embed_only','https://www.usgs.gov/media/webcams/v3cam-kilauea-volcano-hawaii-south-halemaumau-crater','https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits','Source: U.S. Geological Survey. Public domain.',array['www.usgs.gov','url.usgs.gov','www.youtube.com','www.youtube-nocookie.com','youtube.com'],900,86400,false,null),
('usgs-mauna-loa-mlcam','usgs-mauna-loa-mlcam','USGS Mauna Loa Caldera',null,'Current visible view of Mokuʻāweoweo caldera.','usgs','public_domain_live_image','self_host_open','https://www.usgs.gov/volcanoes/mauna-loa/webcams','https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits','Source: U.S. Geological Survey. Public domain.',array['www.usgs.gov','volcanoes.usgs.gov','apps.usgs.gov','usgs-nims-images.s3.amazonaws.com'],300,3600,false,'usgs-mauna-loa-live'),
('usgs-mauna-loa-mtcam','usgs-mauna-loa-mtcam','USGS Mauna Loa Thermal View',null,'Current thermal view of Mokuʻāweoweo caldera.','usgs','public_domain_live_image','self_host_open','https://www.usgs.gov/volcanoes/mauna-loa/webcams','https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits','Source: U.S. Geological Survey. Public domain.',array['www.usgs.gov','volcanoes.usgs.gov','apps.usgs.gov','usgs-nims-images.s3.amazonaws.com'],300,3600,false,'usgs-mauna-loa-live'),
('usgs-mauna-loa-mk2cam','usgs-mauna-loa-mk2cam','USGS Mauna Loa Summit and Northeast Rift',null,'Current summit and Northeast Rift Zone view with Mauna Kea in the distance.','usgs','public_domain_live_image','self_host_open','https://www.usgs.gov/media/webcams/mk2cam-mauna-loas-summit-and-northeast-rift-zone-mauna-kea','https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits','Source: U.S. Geological Survey. Public domain.',array['www.usgs.gov','volcanoes.usgs.gov','apps.usgs.gov','usgs-nims-images.s3.amazonaws.com'],300,3600,false,'usgs-mauna-loa-live'),
('usgs-mauna-loa-mkcam','usgs-mauna-loa-mkcam','USGS Mauna Loa Northwest Flank',null,'Current view of Mauna Loa''s northwest flank.','usgs','public_domain_live_image','self_host_open','https://www.usgs.gov/volcanoes/mauna-loa/webcams','https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits','Source: U.S. Geological Survey. Public domain.',array['www.usgs.gov','volcanoes.usgs.gov','apps.usgs.gov','usgs-nims-images.s3.amazonaws.com'],300,3600,false,'usgs-mauna-loa-live'),
('usgs-river-pequest','usgs-river-pequest','USGS Pequest River',null,'Current view at USGS Streamgage 01445500, Pequest, New Jersey.','usgs','public_domain_live_image','self_host_open','https://www.usgs.gov/media/webcams/streamgage-01445500-pequest-river-pequest-nj','https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits','Source: U.S. Geological Survey. Public domain.',array['www.usgs.gov','volcanoes.usgs.gov','apps.usgs.gov','usgs-nims-images.s3.amazonaws.com'],300,3600,false,'usgs-rivers-lakes-live'),
('usgs-river-delaware-belvidere','usgs-river-delaware-belvidere','USGS Delaware River at Belvidere',null,'Current view at USGS Streamgage 01446500, Belvidere, New Jersey.','usgs','public_domain_live_image','self_host_open','https://www.usgs.gov/media/webcams/streamgage-01446500-delaware-river-belvidere-nj','https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits','Source: U.S. Geological Survey. Public domain.',array['www.usgs.gov','volcanoes.usgs.gov','apps.usgs.gov','usgs-nims-images.s3.amazonaws.com'],300,3600,false,'usgs-rivers-lakes-live'),
('usgs-lake-hopatcong','usgs-lake-hopatcong','USGS Lake Hopatcong',null,'Current view at USGS Streamgage 01455400, Landing, New Jersey.','usgs','public_domain_live_image','self_host_open','https://www.usgs.gov/media/webcams/streamgage-01455400-lake-hopatcong-landing-nj','https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits','Source: U.S. Geological Survey. Public domain.',array['www.usgs.gov','volcanoes.usgs.gov','apps.usgs.gov','usgs-nims-images.s3.amazonaws.com'],300,3600,false,'usgs-rivers-lakes-live'),
('usgs-river-rancocas','usgs-river-rancocas','USGS North Branch Rancocas Creek',null,'Current view at USGS Streamgage 01467000, Pemberton, New Jersey.','usgs','public_domain_live_image','self_host_open','https://www.usgs.gov/media/webcams/streamgage-01467000-north-branch-rancocas-creek-pemberton-nj','https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits','Source: U.S. Geological Survey. Public domain.',array['www.usgs.gov','volcanoes.usgs.gov','apps.usgs.gov','usgs-nims-images.s3.amazonaws.com'],300,3600,false,'usgs-rivers-lakes-live');

insert into public.content_items(
  slug,content_type,hosting_mode,access_level,status,title_en,title_ur,description_en,
  primary_category_id,language,audience,sensitivity,is_featured
)
select s.slug,'live',s.hosting_mode,'public','editorial_review',s.title,s.title_ur,s.description,c.id,
  case when s.title_ur is null then 'en' else 'multi' end,'general','standard',false
from approved_live_inventory s
join public.categories c on c.slug='live'
on conflict(slug) do update set
  title_en=excluded.title_en,
  title_ur=excluded.title_ur,
  description_en=excluded.description_en,
  content_type='live',
  hosting_mode=excluded.hosting_mode,
  access_level='public',
  primary_category_id=excluded.primary_category_id;

update public.content_items c
set status='editorial_review', unpublish_at=null
from approved_live_inventory s
where c.slug=s.slug and c.status in ('draft','rights_review');

insert into public.playback_sources(content_id,provider,provider_content_id,external_url,format,is_primary,status)
select c.id,s.provider::public.source_provider,s.source_key,s.source_url,'external',true,'active'
from approved_live_inventory s
join public.content_items c on c.slug=s.slug
on conflict(provider,provider_content_id) do update set
  content_id=excluded.content_id,
  external_url=excluded.external_url,
  format='external',
  is_primary=true,
  status='active';

insert into public.live_source_configs(
  playback_source_id,source_key,delivery_adapter,official_source_url,terms_url,allowed_hosts,
  expected_media_type,refresh_interval_seconds,freshness_threshold_seconds,off_air_allowed,
  required_attribution,rights_verified_at,next_review_at,enabled,operations_owner
)
select p.id,s.source_key,s.adapter,s.source_url,s.terms_url,s.allowed_hosts,
  case when s.adapter='official_live_embed' then 'official_embed' else 'current_image' end,
  s.refresh_seconds,s.freshness_seconds,s.off_air_allowed,s.attribution,
  timestamptz '2026-08-01 09:51:00+00',timestamptz '2026-10-30 09:51:00+00',false,'content-operations'
from approved_live_inventory s
join public.playback_sources p
  on p.provider=s.provider::public.source_provider and p.provider_content_id=s.source_key
on conflict(playback_source_id) do update set
  source_key=excluded.source_key,
  delivery_adapter=excluded.delivery_adapter,
  official_source_url=excluded.official_source_url,
  terms_url=excluded.terms_url,
  allowed_hosts=excluded.allowed_hosts,
  expected_media_type=excluded.expected_media_type,
  refresh_interval_seconds=excluded.refresh_interval_seconds,
  freshness_threshold_seconds=excluded.freshness_threshold_seconds,
  off_air_allowed=excluded.off_air_allowed,
  required_attribution=excluded.required_attribution,
  rights_verified_at=excluded.rights_verified_at,
  next_review_at=excluded.next_review_at,
  operations_owner=excluded.operations_owner;

insert into public.rights_records(
  content_id,source_url,creator,licence_code,attribution_text,evidence_url,evidence_note,
  takedown_contact,commercial_use_confirmed,modification_confirmed,self_hosting_confirmed,
  embedding_confirmed,status,review_notes,verified_at
)
select c.id,s.source_url,
  case s.provider when 'nasa' then 'NASA' when 'noaa' then 'NOAA Ocean Exploration' else 'U.S. Geological Survey' end,
  case when s.provider='usgs' then 'PUBLIC_DOMAIN_USGS' when s.provider='noaa' then 'PUBLIC_DOMAIN_NOAA' else 'NASA_MEDIA_GUIDELINES' end,
  s.attribution,s.terms_url,
  'Owner-approved initial public-domain live inventory. Official source and usage pages rechecked on 2026-08-01; approval tracked in issue #52.',
  'Jalwa content operations',true,false,(s.adapter='public_domain_live_image'),(s.adapter='official_live_embed'),
  'approved',
  'Use only the committed official adapter. Keep public/free, preserve attribution, do not imply endorsement, do not overlay external players, and fail closed when terms review expires.',
  timestamptz '2026-08-01 09:51:00+00'
from approved_live_inventory s
join public.content_items c on c.slug=s.slug
where not exists (
  select 1 from public.rights_records r where r.content_id=c.id and r.source_url=s.source_url
);

update public.rights_records r
set
  creator=case s.provider when 'nasa' then 'NASA' when 'noaa' then 'NOAA Ocean Exploration' else 'U.S. Geological Survey' end,
  licence_code=case when s.provider='usgs' then 'PUBLIC_DOMAIN_USGS' when s.provider='noaa' then 'PUBLIC_DOMAIN_NOAA' else 'NASA_MEDIA_GUIDELINES' end,
  attribution_text=s.attribution,
  evidence_url=s.terms_url,
  evidence_note='Owner-approved initial public-domain live inventory. Official source and usage pages rechecked on 2026-08-01; approval tracked in issue #52.',
  takedown_contact='Jalwa content operations',
  commercial_use_confirmed=true,
  modification_confirmed=false,
  self_hosting_confirmed=(s.adapter='public_domain_live_image'),
  embedding_confirmed=(s.adapter='official_live_embed'),
  expires_at=null,
  status='approved',
  review_notes='Use only the committed official adapter. Keep public/free, preserve attribution, do not imply endorsement, do not overlay external players, and fail closed when terms review expires.',
  verified_at=timestamptz '2026-08-01 09:51:00+00'
from approved_live_inventory s
join public.content_items c on c.slug=s.slug
where r.content_id=c.id and r.source_url=s.source_url;

insert into public.collections(slug,title_en,description_en,access_level,status)
values
('usgs-mauna-loa-live','USGS Mauna Loa Webcams','Public-domain current views from Mauna Loa.','public','draft'),
('usgs-rivers-lakes-live','USGS Rivers and Lakes','Public-domain current views from selected USGS streamgages.','public','draft')
on conflict(slug) do update set
  title_en=excluded.title_en,
  description_en=excluded.description_en,
  access_level='public';

insert into public.collection_items(collection_id,content_id,sort_order)
select col.id,c.id,row_number() over(partition by col.id order by s.source_key)::integer
from approved_live_inventory s
join public.content_items c on c.slug=s.slug
join public.collections col on col.slug=s.collection_slug
where s.collection_slug is not null
on conflict(collection_id,content_id) do update set sort_order=excluded.sort_order;

insert into public.playback_source_health(
  playback_source_id,status,availability,consecutive_failures,checked_at,message,availability_reason,terms_review_due
)
select p.id,'degraded','degraded',0,now(),
  'Rights approved; awaiting the first environment source-health check.',
  'Rights approved; awaiting the first environment source-health check.',false
from approved_live_inventory s
join public.playback_sources p
  on p.provider=s.provider::public.source_provider and p.provider_content_id=s.source_key
on conflict(playback_source_id) do nothing;

do $$
declare
  v_items integer;
  v_rights integer;
  v_configs integer;
  v_images integer;
begin
  select count(*) into v_items
  from public.content_items c
  join approved_live_inventory s on s.slug=c.slug;

  select count(*) into v_rights
  from public.rights_records r
  join public.content_items c on c.id=r.content_id
  join approved_live_inventory s on s.slug=c.slug
  where r.status='approved' and r.verified_at=timestamptz '2026-08-01 09:51:00+00';

  select count(*) into v_configs
  from public.live_source_configs l
  join approved_live_inventory s on s.source_key=l.source_key
  where l.rights_verified_at=timestamptz '2026-08-01 09:51:00+00'
    and l.next_review_at=timestamptz '2026-10-30 09:51:00+00';

  select count(*) into v_images
  from public.content_items c
  join approved_live_inventory s on s.slug=c.slug
  where s.adapter='public_domain_live_image' and c.hosting_mode='self_host_open';

  if v_items <> 15 then raise exception 'approved live inventory must contain 15 underlying content items'; end if;
  if v_rights <> 15 then raise exception 'every approved live item must have an approved rights record'; end if;
  if v_configs <> 15 then raise exception 'every approved live source must have the recorded 90-day review window'; end if;
  if v_images <> 8 then raise exception 'all eight approved USGS image sources must use self_host_open'; end if;
end $$;

commit;
