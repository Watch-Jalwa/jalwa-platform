-- Refresh launch-critical live-source delivery after upstream URL/hosting drift.
-- This migration is deliberately more restrictive: stale, bot-blocked, private,
-- or externally hosted camera images fall back to the official source page.
-- It does not broaden rights or enable any source that is currently disabled.

begin;

create temporary table live_launch_link_fallbacks (
  source_key text primary key,
  official_source_url text not null,
  reason text not null
);

insert into live_launch_link_fallbacks(source_key,official_source_url,reason) values
  ('usgs-mauna-loa-mtcam','https://www.usgs.gov/volcanoes/mauna-loa/mtcam-mokuaweoweo-caldera-thermal-northwest-rim','The public MTcam image is reachable but stale; link to the current official USGS camera page instead of presenting stale media as live.'),
  ('nps-guadalupe-pine-springs','https://www.nps.gov/media/webcam/view.htm?id=E73E3175-DF46-3AF2-28593FC1F83AE264','The current NPS image is materially stale relative to the approved live-image freshness contract.'),
  ('nps-shenandoah-mountain-view','https://www.nps.gov/media/webcam/view.htm?id=81B46B71-1DD8-B71B-0B55074571E08B1E','The current NPS page now points to a third-party PhenoCam image that is outside the retained self-hosting approval.'),
  ('nps-shenandoah-big-meadows','https://www.nps.gov/media/webcam/view.htm?id=81B46B99-1DD8-B71B-0B124A40CC3384CE','The public NPS image endpoint rejects proxy delivery; retain the official NPS page.'),
  ('nps-glacier-night-sky','https://www.nps.gov/media/webcam/view.htm?id=D4BDFE7E-AC7F-D681-8A03C820E06CBA0A','The public NPS image endpoint rejects proxy delivery; retain the official NPS page.'),
  ('nps-painted-desert-inn','https://www.nps.gov/media/webcam/view.htm?id=81B46C72-1DD8-B71B-0BDC8D1824EBB9A7','The NPS page exposes only a private-network camera image URL, which Jalwa must never proxy.'),
  ('nps-el-morro','https://www.nps.gov/media/webcam/view.htm?id=81B46AD5-1DD8-B71B-0BFB3F36B5DDC6EF','The public NPS image endpoint rejects proxy delivery; retain the official NPS page.');

update public.content_items c
set hosting_mode='external_link'
from public.approved_live_catalogue_manifest m
join live_launch_link_fallbacks f on f.source_key=m.source_key
where c.slug=m.slug;

update public.playback_sources p
set external_url=f.official_source_url,
    format='external',
    status='active'
from public.live_source_configs l
join live_launch_link_fallbacks f on f.source_key=l.source_key
where l.playback_source_id=p.id;

update public.live_source_configs l
set delivery_adapter='official_live_link',
    official_source_url=f.official_source_url,
    expected_media_type='official_link',
    refresh_interval_seconds=900,
    freshness_threshold_seconds=86400,
    off_air_allowed=true
from live_launch_link_fallbacks f
where l.source_key=f.source_key;

update public.rights_records r
set self_hosting_confirmed=false,
    embedding_confirmed=false,
    review_notes=concat_ws(E'\n', nullif(r.review_notes,''), '2026-09-29 launch hardening: delivery reduced to official-link only. ', f.reason)
from public.content_items c
join public.approved_live_catalogue_manifest m on m.slug=c.slug
join live_launch_link_fallbacks f on f.source_key=m.source_key
where r.content_id=c.id;

do $$
declare
  v_images integer;
  v_links integer;
  v_embeds integer;
  v_fallbacks integer;
begin
  select count(*) into v_fallbacks
  from public.live_source_configs l
  join live_launch_link_fallbacks f on f.source_key=l.source_key
  join public.playback_sources p on p.id=l.playback_source_id
  join public.content_items c on c.id=p.content_id
  where l.delivery_adapter='official_live_link'
    and l.expected_media_type='official_link'
    and c.hosting_mode='external_link'
    and p.status='active';

  select count(*) into v_images
  from public.live_source_configs l
  join public.playback_sources p on p.id=l.playback_source_id
  join public.content_items c on c.id=p.content_id
  join public.approved_live_catalogue_manifest m on m.source_key=l.source_key
  where l.delivery_adapter='public_domain_live_image'
    and l.expected_media_type='current_image'
    and c.hosting_mode='self_host_open';

  select count(*) into v_links
  from public.live_source_configs l
  join public.playback_sources p on p.id=l.playback_source_id
  join public.content_items c on c.id=p.content_id
  join public.approved_live_catalogue_manifest m on m.source_key=l.source_key
  where l.delivery_adapter='official_live_link'
    and l.expected_media_type='official_link'
    and c.hosting_mode='external_link';

  select count(*) into v_embeds
  from public.live_source_configs l
  join public.approved_live_catalogue_manifest m on m.source_key=l.source_key
  where l.delivery_adapter='official_live_embed';

  if v_fallbacks <> 7 then raise exception 'Launch live-source fallbacks are incomplete'; end if;
  if v_images <> 16 then raise exception 'Launch current-image inventory must contain 16 safe sources'; end if;
  if v_links <> 29 then raise exception 'Launch official-link inventory must contain 29 sources'; end if;
  if v_embeds <> 7 then raise exception 'Launch official-embed inventory must remain 7 sources'; end if;
end $$;

commit;
