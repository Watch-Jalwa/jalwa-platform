\set ON_ERROR_STOP on

-- Public-domain live fixtures may run only in staging. Production activation is an
-- explicit, separately approved release operation.
select set_config('jalwa.deployment_environment', :'deployment_environment', false);
do $$
begin
  if current_setting('jalwa.deployment_environment', true) <> 'staging' then
    raise exception 'Public-domain live source fixtures may run only in staging';
  end if;
end $$;

begin;

create temporary table live_seed (
  source_key text primary key,
  slug text not null,
  title text not null,
  title_ur text,
  description text not null,
  provider text not null,
  adapter public.live_delivery_adapter not null,
  source_url text not null,
  terms_url text not null,
  attribution text not null,
  allowed_hosts text[] not null,
  refresh_seconds integer not null,
  freshness_seconds integer not null,
  off_air_allowed boolean not null default false,
  collection_slug text
);

insert into live_seed values
('nasa-space-station-views','nasa-space-station-views','NASA Space Station Views','ناسا خلائی اسٹیشن کے براہ راست مناظر','Live views from the International Space Station with mission audio when available.','nasa','official_live_embed','https://www.nasa.gov/live/','https://www.nasa.gov/nasa-brand-center/images-and-media/','Source: NASA. NASA does not endorse Jalwa or its advertisers.',array['www.nasa.gov','www.youtube.com','www.youtube-nocookie.com','youtube.com'],900,86400,false,null),
('noaa-ocean-camera-1','noaa-ocean-exploration-camera-1','NOAA Ocean Exploration Camera 1','نوآ سمندری تحقیق کیمرا 1','Official NOAA Ocean Exploration live video. Audio is generally available during dives.','noaa','official_live_embed','https://oceanexplorer.noaa.gov/livestreams/','https://oceanexplorer.noaa.gov/about/media-kit/','Courtesy of NOAA Ocean Exploration.',array['oceanexplorer.noaa.gov','www.youtube.com','www.youtube-nocookie.com','youtube.com'],300,3600,true,null),
('noaa-ocean-camera-2','noaa-ocean-exploration-camera-2','NOAA Ocean Exploration Camera 2','نوآ سمندری تحقیق کیمرا 2','Official NOAA Ocean Exploration secondary live camera.','noaa','official_live_embed','https://oceanexplorer.noaa.gov/livestreams/','https://oceanexplorer.noaa.gov/about/media-kit/','Courtesy of NOAA Ocean Exploration.',array['oceanexplorer.noaa.gov','www.youtube.com','www.youtube-nocookie.com','youtube.com'],300,3600,true,null),
('noaa-ocean-camera-3','noaa-ocean-exploration-camera-3','NOAA Ocean Exploration Camera 3','نوآ سمندری تحقیق کیمرا 3','Official NOAA Ocean Exploration live video. Audio is generally available during dives.','noaa','official_live_embed','https://oceanexplorer.noaa.gov/livestreams/','https://oceanexplorer.noaa.gov/about/media-kit/','Courtesy of NOAA Ocean Exploration.',array['oceanexplorer.noaa.gov','www.youtube.com','www.youtube-nocookie.com','youtube.com'],300,3600,true,null),
('usgs-kilauea-v1','usgs-kilauea-v1','USGS Kīlauea V1','یو ایس جی ایس کیلاؤیا V1','Live western view of Halemaʻumaʻu crater from the Kīlauea summit.','usgs','official_live_embed','https://www.usgs.gov/volcanoes/kilauea/v1cam-kilauea-volcano-hawaii-west-halemaumau-crater','https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits','Source: U.S. Geological Survey. Public domain.',array['www.usgs.gov','url.usgs.gov','www.youtube.com','www.youtube-nocookie.com','youtube.com'],900,86400,false,null),
('usgs-kilauea-v2','usgs-kilauea-v2','USGS Kīlauea V2','یو ایس جی ایس کیلاؤیا V2','Live eastern view of Halemaʻumaʻu crater from the Kīlauea summit.','usgs','official_live_embed','https://www.usgs.gov/media/webcams/v2cam-kilauea-volcano-hawaii-east-halemaumau-crater','https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits','Source: U.S. Geological Survey. Public domain.',array['www.usgs.gov','url.usgs.gov','www.youtube.com','www.youtube-nocookie.com','youtube.com'],900,86400,false,null),
('usgs-kilauea-v3','usgs-kilauea-v3','USGS Kīlauea V3','یو ایس جی ایس کیلاؤیا V3','Live southern view of Halemaʻumaʻu crater from the Kīlauea summit.','usgs','official_live_embed','https://www.usgs.gov/media/webcams/v3cam-kilauea-volcano-hawaii-south-halemaumau-crater','https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits','Source: U.S. Geological Survey. Public domain.',array['www.usgs.gov','url.usgs.gov','www.youtube.com','www.youtube-nocookie.com','youtube.com'],900,86400,false,null),
('usgs-mauna-loa-mlcam','usgs-mauna-loa-mlcam','USGS Mauna Loa Caldera',null,'Current visible view of Mokuʻāweoweo caldera.','usgs','public_domain_live_image','https://www.usgs.gov/volcanoes/mauna-loa/webcams','https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits','Source: U.S. Geological Survey. Public domain.',array['www.usgs.gov','volcanoes.usgs.gov','apps.usgs.gov','usgs-nims-images.s3.amazonaws.com'],300,3600,false,'usgs-mauna-loa-live'),
('usgs-mauna-loa-mtcam','usgs-mauna-loa-mtcam','USGS Mauna Loa Thermal View',null,'Current thermal view of Mokuʻāweoweo caldera.','usgs','public_domain_live_image','https://www.usgs.gov/volcanoes/mauna-loa/webcams','https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits','Source: U.S. Geological Survey. Public domain.',array['www.usgs.gov','volcanoes.usgs.gov','apps.usgs.gov','usgs-nims-images.s3.amazonaws.com'],300,3600,false,'usgs-mauna-loa-live'),
('usgs-mauna-loa-mk2cam','usgs-mauna-loa-mk2cam','USGS Mauna Loa Summit and Northeast Rift',null,'Current summit and Northeast Rift Zone view with Mauna Kea in the distance.','usgs','public_domain_live_image','https://www.usgs.gov/media/webcams/mk2cam-mauna-loas-summit-and-northeast-rift-zone-mauna-kea','https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits','Source: U.S. Geological Survey. Public domain.',array['www.usgs.gov','volcanoes.usgs.gov','apps.usgs.gov','usgs-nims-images.s3.amazonaws.com'],300,3600,false,'usgs-mauna-loa-live'),
('usgs-mauna-loa-mkcam','usgs-mauna-loa-mkcam','USGS Mauna Loa Northwest Flank',null,'Current view of Mauna Loa''s northwest flank.','usgs','public_domain_live_image','https://www.usgs.gov/volcanoes/mauna-loa/webcams','https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits','Source: U.S. Geological Survey. Public domain.',array['www.usgs.gov','volcanoes.usgs.gov','apps.usgs.gov','usgs-nims-images.s3.amazonaws.com'],300,3600,false,'usgs-mauna-loa-live'),
('usgs-river-pequest','usgs-river-pequest','USGS Pequest River',null,'Current view at USGS Streamgage 01445500, Pequest, New Jersey.','usgs','public_domain_live_image','https://www.usgs.gov/media/webcams/streamgage-01445500-pequest-river-pequest-nj','https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits','Source: U.S. Geological Survey. Public domain.',array['www.usgs.gov','volcanoes.usgs.gov','apps.usgs.gov','usgs-nims-images.s3.amazonaws.com'],300,3600,false,'usgs-rivers-lakes-live'),
('usgs-river-delaware-belvidere','usgs-river-delaware-belvidere','USGS Delaware River at Belvidere',null,'Current view at USGS Streamgage 01446500, Belvidere, New Jersey.','usgs','public_domain_live_image','https://www.usgs.gov/media/webcams/streamgage-01446500-delaware-river-belvidere-nj','https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits','Source: U.S. Geological Survey. Public domain.',array['www.usgs.gov','volcanoes.usgs.gov','apps.usgs.gov','usgs-nims-images.s3.amazonaws.com'],300,3600,false,'usgs-rivers-lakes-live'),
('usgs-lake-hopatcong','usgs-lake-hopatcong','USGS Lake Hopatcong',null,'Current view at USGS Streamgage 01455400, Landing, New Jersey.','usgs','public_domain_live_image','https://www.usgs.gov/media/webcams/streamgage-01455400-lake-hopatcong-landing-nj','https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits','Source: U.S. Geological Survey. Public domain.',array['www.usgs.gov','volcanoes.usgs.gov','apps.usgs.gov','usgs-nims-images.s3.amazonaws.com'],300,3600,false,'usgs-rivers-lakes-live'),
('usgs-river-rancocas','usgs-river-rancocas','USGS North Branch Rancocas Creek',null,'Current view at USGS Streamgage 01467000, Pemberton, New Jersey.','usgs','public_domain_live_image','https://www.usgs.gov/media/webcams/streamgage-01467000-north-branch-rancocas-creek-pemberton-nj','https://www.usgs.gov/information-policies-and-instructions/copyrights-and-credits','Source: U.S. Geological Survey. Public domain.',array['www.usgs.gov','volcanoes.usgs.gov','apps.usgs.gov','usgs-nims-images.s3.amazonaws.com'],300,3600,false,'usgs-rivers-lakes-live');

insert into public.content_items(
  slug,content_type,hosting_mode,access_level,status,title_en,title_ur,description_en,
  primary_category_id,language,audience,sensitivity,is_featured
)
select s.slug,'live','embed_only','public','draft',s.title,s.title_ur,s.description,c.id,
  case when s.title_ur is null then 'en' else 'multi' end,'general','standard',false
from live_seed s
join public.categories c on c.slug='live'
on conflict(slug) do update set
  title_en=excluded.title_en,title_ur=excluded.title_ur,description_en=excluded.description_en,
  content_type='live',hosting_mode='embed_only',access_level='public',primary_category_id=excluded.primary_category_id;

insert into public.playback_sources(content_id,provider,provider_content_id,external_url,format,is_primary,status)
select c.id,s.provider::public.source_provider,s.source_key,s.source_url,'external',true,'active'
from live_seed s join public.content_items c on c.slug=s.slug
on conflict(provider,provider_content_id) do update set
  content_id=excluded.content_id,external_url=excluded.external_url,format='external',is_primary=true,status='active';

insert into public.live_source_configs(
  playback_source_id,source_key,delivery_adapter,official_source_url,terms_url,allowed_hosts,
  expected_media_type,refresh_interval_seconds,freshness_threshold_seconds,off_air_allowed,
  required_attribution,rights_verified_at,next_review_at,enabled,operations_owner
)
select p.id,s.source_key,s.adapter,s.source_url,s.terms_url,s.allowed_hosts,
  case when s.adapter='official_live_embed' then 'official_embed' else 'current_image' end,
  s.refresh_seconds,s.freshness_seconds,s.off_air_allowed,s.attribution,null,null,false,'content-operations'
from live_seed s
join public.playback_sources p on p.provider=s.provider::public.source_provider and p.provider_content_id=s.source_key
on conflict(playback_source_id) do update set
  source_key=excluded.source_key,delivery_adapter=excluded.delivery_adapter,
  official_source_url=excluded.official_source_url,terms_url=excluded.terms_url,
  allowed_hosts=excluded.allowed_hosts,expected_media_type=excluded.expected_media_type,
  refresh_interval_seconds=excluded.refresh_interval_seconds,
  freshness_threshold_seconds=excluded.freshness_threshold_seconds,
  off_air_allowed=excluded.off_air_allowed,required_attribution=excluded.required_attribution;

insert into public.rights_records(
  content_id,source_url,creator,licence_code,attribution_text,evidence_url,evidence_note,
  takedown_contact,commercial_use_confirmed,modification_confirmed,self_hosting_confirmed,
  embedding_confirmed,status,review_notes
)
select c.id,s.source_url,
  case s.provider when 'nasa' then 'NASA' when 'noaa' then 'NOAA Ocean Exploration' else 'U.S. Geological Survey' end,
  case when s.provider='usgs' then 'PUBLIC_DOMAIN_USGS' when s.provider='noaa' then 'PUBLIC_DOMAIN_NOAA' else 'NASA_MEDIA_GUIDELINES' end,
  s.attribution,s.terms_url,'Staging fixture. Reviewer must retain dated item-level evidence before approval.',
  'Jalwa content operations',true,false,(s.adapter='public_domain_live_image'),(s.adapter='official_live_embed'),
  'pending','Confirm official source, current terms, attribution, non-endorsement and exact delivery adapter.'
from live_seed s join public.content_items c on c.slug=s.slug
where not exists(select 1 from public.rights_records r where r.content_id=c.id and r.source_url=s.source_url);

insert into public.collections(slug,title_en,description_en,access_level,status)
values
('usgs-mauna-loa-live','USGS Mauna Loa Webcams','Public-domain current views from Mauna Loa.','public','draft'),
('usgs-rivers-lakes-live','USGS Rivers and Lakes','Public-domain current views from selected USGS streamgages.','public','draft')
on conflict(slug) do update set title_en=excluded.title_en,description_en=excluded.description_en,access_level='public';

insert into public.collection_items(collection_id,content_id,sort_order)
select col.id,c.id,row_number() over(partition by col.id order by s.source_key)::integer
from live_seed s
join public.content_items c on c.slug=s.slug
join public.collections col on col.slug=s.collection_slug
where s.collection_slug is not null
on conflict(collection_id,content_id) do update set sort_order=excluded.sort_order;

insert into public.playback_source_health(
  playback_source_id,status,availability,consecutive_failures,checked_at,message,availability_reason,terms_review_due
)
select p.id,'degraded','degraded',0,now(),'Awaiting source approval and first staging health check.','Awaiting source approval and first staging health check.',false
from live_seed s
join public.playback_sources p on p.provider=s.provider::public.source_provider and p.provider_content_id=s.source_key
on conflict(playback_source_id) do nothing;

commit;

select jsonb_build_object(
  'content_items',(select count(*) from public.content_items where slug in (select slug from live_seed)),
  'source_configs',(select count(*) from public.live_source_configs where source_key in (select source_key from live_seed)),
  'collections',(select count(*) from public.collections where slug in ('usgs-mauna-loa-live','usgs-rivers-lakes-live')),
  'published',(select count(*) from public.content_items where slug in (select slug from live_seed) and status='published'),
  'enabled',(select count(*) from public.live_source_configs where source_key in (select source_key from live_seed) and enabled)
) as public_domain_live_seed_summary;
