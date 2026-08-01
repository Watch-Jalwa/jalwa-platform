-- Deployment-ready expansion from 15 to 46 user-facing live entries.
-- NPS-owned current images use the secured image adapter. DVIDS, additional
-- NASA services and Tier-B institutional sources remain official-link only so
-- event-level third-party material can never be silently embedded or restreamed.

begin;
alter type public.source_provider add value if not exists 'dvids';
alter type public.source_provider add value if not exists 'nps';
alter type public.source_provider add value if not exists 'nih';
alter type public.source_provider add value if not exists 'fda';
alter type public.source_provider add value if not exists 'sec';
alter type public.source_provider add value if not exists 'fcc';
alter type public.source_provider add value if not exists 'european_commission';
alter type public.source_provider add value if not exists 'us_house';
alter type public.source_provider add value if not exists 'us_senate';
commit;

begin;

create temporary table open_government_live_inventory (
  source_key text primary key,
  slug text not null unique,
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
  licence_code text not null,
  commercial_use_confirmed boolean not null,
  self_hosting_confirmed boolean not null,
  evidence_note text not null,
  review_notes text not null
);

insert into open_government_live_inventory values
('dvids-live-webcasts','dvids-live-webcasts','DVIDS Live Webcasts','ڈی وی آئی ڈی ایس براہ راست نشریات','Upcoming official U.S. Department of Defense public-affairs webcasts. Individual events remain subject to their displayed rights metadata.','dvids','official_live_link','external_link','https://www.dvidshub.net/webcast','https://www.dvidshub.net/about/copyright','Source: Defense Visual Information Distribution Service. No endorsement of Jalwa is implied.',array['www.dvidshub.net','dvidshub.net'],900,86400,'DVIDS_EVENT_FILTERED_OFFICIAL_LINK',false,false,'DVIDS copyright and API guidance reviewed 2026-08-01. This record approves only an official catalogue link; each webcast must retain a public-domain status before any future inline use.','Keep public/free. Do not embed, cache, record or restream under this record. Third-party or restricted events remain excluded.'),
('dvids-pentagon-press-briefings','dvids-pentagon-press-briefings','Pentagon Press Briefings','پینٹاگون پریس بریفنگز','Official Pentagon press-briefing coverage published through DVIDS.','dvids','official_live_link','external_link','https://www.dvidshub.net/feature/PentagonPressBriefings','https://www.dvidshub.net/about/copyright','Source: Defense Visual Information Distribution Service. No endorsement of Jalwa is implied.',array['www.dvidshub.net','dvidshub.net'],900,86400,'DVIDS_EVENT_FILTERED_OFFICIAL_LINK',false,false,'DVIDS public-domain guidance reviewed 2026-08-01. Official-link delivery only; event-level metadata controls any future embed.','No inline player, capture, recording, restreaming or endorsement. Preserve the source link and attribution.'),
('dvids-white-house-public-events','dvids-white-house-public-events','White House Public Events via DVIDS','وائٹ ہاؤس عوامی تقریبات بذریعہ ڈی وی آئی ڈی ایس','Official public events made available through the DVIDS webcast catalogue.','dvids','official_live_link','external_link','https://www.dvidshub.net/webcast','https://www.dvidshub.net/about/copyright','Source: Defense Visual Information Distribution Service. No endorsement of Jalwa is implied.',array['www.dvidshub.net','dvidshub.net'],900,86400,'DVIDS_EVENT_FILTERED_OFFICIAL_LINK',false,false,'DVIDS guidance reviewed 2026-08-01. Link-only approval because individual event rights and third-party content can vary.','Event-level positive public-domain metadata is mandatory before any future inline playback.'),
('dvids-navy-recruit-graduations','dvids-navy-recruit-graduations','U.S. Navy Recruit Training Graduations','امریکی بحریہ ریکروٹ ٹریننگ گریجویشن','Official recruit-training graduation webcasts listed by DVIDS.','dvids','official_live_link','external_link','https://www.dvidshub.net/webcast','https://www.dvidshub.net/about/copyright','Source: Defense Visual Information Distribution Service. No endorsement of Jalwa is implied.',array['www.dvidshub.net','dvidshub.net'],900,86400,'DVIDS_EVENT_FILTERED_OFFICIAL_LINK',false,false,'DVIDS guidance reviewed 2026-08-01. Official-link approval only.','Do not use service marks as Jalwa branding. No inline playback without event-level public-domain evidence.'),
('dvids-defense-conferences-ceremonies','dvids-defense-conferences-ceremonies','Defense Conferences and Ceremonies','دفاعی کانفرنسیں اور تقریبات','Official defense conferences, ceremonies and public-affairs events listed by DVIDS.','dvids','official_live_link','external_link','https://www.dvidshub.net/webcast','https://www.dvidshub.net/about/copyright','Source: Defense Visual Information Distribution Service. No endorsement of Jalwa is implied.',array['www.dvidshub.net','dvidshub.net'],900,86400,'DVIDS_EVENT_FILTERED_OFFICIAL_LINK',false,false,'DVIDS guidance reviewed 2026-08-01. Official-link approval only because conference presentations can contain third-party material.','No inline use unless the selected event is explicitly public domain and free of third-party restrictions.'),

('nasa-plus-live-events','nasa-plus-live-events','NASA+ Live Events','ناسا پلس براہ راست تقریبات','Official NASA+ live and upcoming event schedule.','nasa','official_live_link','external_link','https://plus.nasa.gov/scheduled-events/','https://www.nasa.gov/nasa-brand-center/images-and-media/','Source: NASA. NASA does not endorse Jalwa or its advertisers.',array['plus.nasa.gov','www.nasa.gov','nasa.gov'],900,86400,'NASA_MEDIA_GUIDELINES_LINK_ONLY',false,false,'NASA media guidelines and NASA+ schedule reviewed 2026-08-01. Official-link approval avoids third-party music, partner footage and event-specific restrictions.','Keep public/free, preserve attribution and non-endorsement. No inline use without event-level review.'),
('nasa-mission-launch-coverage','nasa-mission-launch-coverage','NASA Mission and Launch Coverage','ناسا مشن اور لانچ کوریج','Official NASA mission, launch and agency-event coverage.','nasa','official_live_link','external_link','https://www.nasa.gov/live/','https://www.nasa.gov/nasa-brand-center/images-and-media/','Source: NASA. NASA does not endorse Jalwa or its advertisers.',array['plus.nasa.gov','www.nasa.gov','nasa.gov'],900,86400,'NASA_MEDIA_GUIDELINES_LINK_ONLY',false,false,'NASA live and media guidance reviewed 2026-08-01. Link-only approval protects against event-level third-party content.','No extraction, recording or restreaming. Future embed requires a specific approved NASA-owned event source.'),
('nasa-space-to-ground','nasa-space-to-ground','NASA Space-to-Ground','ناسا اسپیس ٹو گراؤنڈ','Official NASA space-station news, mission audio and scheduled coverage.','nasa','official_live_link','external_link','https://plus.nasa.gov/topics/news-events/','https://www.nasa.gov/nasa-brand-center/images-and-media/','Source: NASA. NASA does not endorse Jalwa or its advertisers.',array['plus.nasa.gov','www.nasa.gov','nasa.gov'],900,86400,'NASA_MEDIA_GUIDELINES_LINK_ONLY',false,false,'NASA news/events and media guidance reviewed 2026-08-01. Link-only approval.','No implied endorsement or use of NASA identifiers as Jalwa branding.'),

('nps-devils-tower-entrance','nps-devils-tower-entrance','NPS Devils Tower Entrance','نیشنل پارک سروس ڈیولز ٹاور داخلی منظر','Current official National Park Service view near the Devils Tower entrance.','nps','public_domain_live_image','self_host_open','https://www.nps.gov/media/webcam/view.htm?id=353840EE-9D49-67A6-C3D2292B5251E4DD','https://www.nps.gov/aboutus/disclaimer.htm','Source: National Park Service. No claim to original U.S. Government works. NPS does not endorse Jalwa.',array['www.nps.gov','home.nps.gov'],300,7200,'PUBLIC_DOMAIN_NPS_CURRENT_IMAGE',true,true,'NPS disclaimer and the official NPS-hosted webcam page reviewed 2026-08-01. Only the current image under the allowlisted /webcams-* path is approved.','Do not use the NPS Arrowhead or other marks as Jalwa branding. No partner camera substitution.'),
('nps-mount-rainier-sunrise','nps-mount-rainier-sunrise','NPS Mount Rainier Sunrise','ماؤنٹ رینیئر سن رائز منظر','Current official National Park Service view from Sunrise at Mount Rainier.','nps','public_domain_live_image','self_host_open','https://www.nps.gov/media/webcam/view.htm?id=81B462EC-1DD8-B71B-0B99F890C596FA16','https://www.nps.gov/aboutus/disclaimer.htm','Source: National Park Service. No claim to original U.S. Government works. NPS does not endorse Jalwa.',array['www.nps.gov','home.nps.gov'],300,7200,'PUBLIC_DOMAIN_NPS_CURRENT_IMAGE',true,true,'Official NPS-hosted webcam and disclaimer reviewed 2026-08-01.','Current image only; preserve credit and reject non-NPS or partner-hosted replacements.'),
('nps-mount-rainier-paradise','nps-mount-rainier-paradise','NPS Mount Rainier Paradise','ماؤنٹ رینیئر پیراڈائز منظر','Current official National Park Service mountain view from Paradise.','nps','public_domain_live_image','self_host_open','https://www.nps.gov/media/webcam/view.htm?id=81B46307-1DD8-B71B-0B72918A4B2EB790','https://www.nps.gov/aboutus/disclaimer.htm','Source: National Park Service. No claim to original U.S. Government works. NPS does not endorse Jalwa.',array['www.nps.gov','home.nps.gov'],300,7200,'PUBLIC_DOMAIN_NPS_CURRENT_IMAGE',true,true,'Official NPS-hosted webcam and disclaimer reviewed 2026-08-01.','Current image only; no logo use or implied endorsement.'),
('nps-mount-rainier-tatoosh','nps-mount-rainier-tatoosh','NPS Mount Rainier Tatoosh Range','ماؤنٹ رینیئر ٹیٹوش رینج','Current official National Park Service view of the Tatoosh Range.','nps','public_domain_live_image','self_host_open','https://www.nps.gov/media/webcam/view.htm?id=81B46402-1DD8-B71B-0B95C911C1395AAC','https://www.nps.gov/aboutus/disclaimer.htm','Source: National Park Service. No claim to original U.S. Government works. NPS does not endorse Jalwa.',array['www.nps.gov','home.nps.gov'],300,7200,'PUBLIC_DOMAIN_NPS_CURRENT_IMAGE',true,true,'Official NPS-hosted webcam and disclaimer reviewed 2026-08-01.','Current image only; no partner substitution.'),
('nps-guadalupe-pine-springs','nps-guadalupe-pine-springs','NPS Guadalupe Pine Springs Canyon','گواڈالوپ پائن اسپرنگز کینین','Current official National Park Service view from Pine Springs Canyon.','nps','public_domain_live_image','self_host_open','https://www.nps.gov/media/webcam/view.htm?id=E73E3175-DF46-3AF2-28593FC1F83AE264','https://www.nps.gov/aboutus/disclaimer.htm','Source: National Park Service. No claim to original U.S. Government works. NPS does not endorse Jalwa.',array['www.nps.gov','home.nps.gov'],300,7200,'PUBLIC_DOMAIN_NPS_CURRENT_IMAGE',true,true,'Official NPS-hosted webcam and disclaimer reviewed 2026-08-01.','Current image only; preserve source credit.'),
('nps-guadalupe-el-capitan','nps-guadalupe-el-capitan','NPS Guadalupe El Capitan','گواڈالوپ ایل کیپٹن منظر','Current official National Park Service view of El Capitan.','nps','public_domain_live_image','self_host_open','https://www.nps.gov/media/webcam/view.htm?id=9849DE2B-BC23-1110-33CED7C04E8AAF05','https://www.nps.gov/aboutus/disclaimer.htm','Source: National Park Service. No claim to original U.S. Government works. NPS does not endorse Jalwa.',array['www.nps.gov','home.nps.gov'],300,7200,'PUBLIC_DOMAIN_NPS_CURRENT_IMAGE',true,true,'Official NPS-hosted webcam and disclaimer reviewed 2026-08-01.','Current image only; preserve source credit.'),
('nps-shenandoah-mountain-view','nps-shenandoah-mountain-view','NPS Shenandoah Mountain View','شیننڈوا پہاڑی منظر','Current official National Park Service mountain view in Shenandoah.','nps','public_domain_live_image','self_host_open','https://www.nps.gov/media/webcam/view.htm?id=81B46B71-1DD8-B71B-0B55074571E08B1E','https://www.nps.gov/aboutus/disclaimer.htm','Source: National Park Service. No claim to original U.S. Government works. NPS does not endorse Jalwa.',array['www.nps.gov','home.nps.gov'],300,7200,'PUBLIC_DOMAIN_NPS_CURRENT_IMAGE',true,true,'Official NPS-hosted current image and disclaimer reviewed 2026-08-01. External PhenoCam assets are not approved by this record.','Only NPS-hosted /webcams-* imagery may pass the resolver.'),
('nps-shenandoah-big-meadows','nps-shenandoah-big-meadows','NPS Shenandoah Big Meadows','شیننڈوا بگ میڈوز','Current official National Park Service view of Big Meadows.','nps','public_domain_live_image','self_host_open','https://www.nps.gov/media/webcam/view.htm?id=81B46B99-1DD8-B71B-0B124A40CC3384CE','https://www.nps.gov/aboutus/disclaimer.htm','Source: National Park Service. No claim to original U.S. Government works. NPS does not endorse Jalwa.',array['www.nps.gov','home.nps.gov'],300,7200,'PUBLIC_DOMAIN_NPS_CURRENT_IMAGE',true,true,'Official NPS-hosted webcam and disclaimer reviewed 2026-08-01.','Current image only; preserve attribution.'),
('nps-smokies-newfound-gap','nps-smokies-newfound-gap','NPS Great Smoky Mountains Newfound Gap','گریٹ اسموکی ماؤنٹینز نیوفاؤنڈ گیپ','Current official National Park Service view at Newfound Gap.','nps','public_domain_live_image','self_host_open','https://www.nps.gov/media/webcam/view.htm?id=C589EEEF-1DD8-B71B-0B0463C308FF64DD','https://www.nps.gov/aboutus/disclaimer.htm','Source: National Park Service. No claim to original U.S. Government works. NPS does not endorse Jalwa.',array['www.nps.gov','home.nps.gov'],300,7200,'PUBLIC_DOMAIN_NPS_CURRENT_IMAGE',true,true,'Official NPS-hosted webcam and disclaimer reviewed 2026-08-01.','Current image only; fail closed if hosting changes.'),
('nps-point-reyes-beach','nps-point-reyes-beach','NPS Point Reyes Beach','پوائنٹ ریئس ساحلی منظر','Current official National Park Service beach view at Point Reyes.','nps','public_domain_live_image','self_host_open','https://www.nps.gov/media/webcam/view.htm?id=5A967BB2-CB78-43A7-1C861C4554D5D50D','https://www.nps.gov/aboutus/disclaimer.htm','Source: National Park Service. No claim to original U.S. Government works. NPS does not endorse Jalwa.',array['www.nps.gov','home.nps.gov'],300,7200,'PUBLIC_DOMAIN_NPS_CURRENT_IMAGE',true,true,'Official NPS-hosted beach camera and disclaimer reviewed 2026-08-01. Partner-operated Point Reyes cameras are explicitly excluded.','Do not substitute the separately operated lifeboat or partner cameras.'),
('nps-yellowstone-electric-peak','nps-yellowstone-electric-peak','NPS Yellowstone Electric Peak','ییلو اسٹون الیکٹرک پیک','Current official National Park Service north-entrance and Electric Peak view.','nps','public_domain_live_image','self_host_open','https://www.nps.gov/media/webcam/view.htm?id=81B468AB-1DD8-B71B-0BE84D8E8E0F1112','https://www.nps.gov/aboutus/disclaimer.htm','Source: National Park Service. No claim to original U.S. Government works. NPS does not endorse Jalwa.',array['www.nps.gov','home.nps.gov'],300,7200,'PUBLIC_DOMAIN_NPS_CURRENT_IMAGE',true,true,'Official NPS-hosted webcam and disclaimer reviewed 2026-08-01.','This record does not approve the partner-operated Old Faithful stream.'),
('nps-glacier-night-sky','nps-glacier-night-sky','NPS Glacier Night Sky','گلیشیئر نائٹ اسکائی','Current official National Park Service night-sky view in Glacier National Park.','nps','public_domain_live_image','self_host_open','https://www.nps.gov/media/webcam/view.htm?id=D4BDFE7E-AC7F-D681-8A03C820E06CBA0A','https://www.nps.gov/aboutus/disclaimer.htm','Source: National Park Service. No claim to original U.S. Government works. NPS does not endorse Jalwa.',array['www.nps.gov','home.nps.gov'],300,7200,'PUBLIC_DOMAIN_NPS_CURRENT_IMAGE',true,true,'Official NPS-hosted current-image page and disclaimer reviewed 2026-08-01.','Only the NPS-hosted current image is approved; foundation marks are excluded.'),
('nps-bunker-hill-west','nps-bunker-hill-west','NPS Bunker Hill Monument West View','بنکر ہل یادگار مغربی منظر','Current official National Park Service westward view from Bunker Hill Monument.','nps','public_domain_live_image','self_host_open','https://www.nps.gov/media/webcam/view.htm?id=B17835F2-AC01-8A62-F2F0EC85B33643D3','https://www.nps.gov/aboutus/disclaimer.htm','Source: National Park Service. No claim to original U.S. Government works. NPS does not endorse Jalwa.',array['www.nps.gov','home.nps.gov'],300,7200,'PUBLIC_DOMAIN_NPS_CURRENT_IMAGE',true,true,'Official NPS-hosted webcam and disclaimer reviewed 2026-08-01.','Current image only; preserve source credit.'),
('nps-painted-desert-inn','nps-painted-desert-inn','NPS Painted Desert Inn','پینٹڈ ڈیزرٹ اِن منظر','Current official National Park Service view at Painted Desert Inn.','nps','public_domain_live_image','self_host_open','https://www.nps.gov/media/webcam/view.htm?id=81B46C72-1DD8-B71B-0BDC8D1824EBB9A7','https://www.nps.gov/aboutus/disclaimer.htm','Source: National Park Service. No claim to original U.S. Government works. NPS does not endorse Jalwa.',array['www.nps.gov','home.nps.gov'],300,7200,'PUBLIC_DOMAIN_NPS_CURRENT_IMAGE',true,true,'Official NPS-hosted webcam and disclaimer reviewed 2026-08-01.','Current image only; preserve source credit.'),
('nps-el-morro','nps-el-morro','NPS El Morro National Monument','ایل مورو قومی یادگار','Current official National Park Service view at El Morro National Monument.','nps','public_domain_live_image','self_host_open','https://www.nps.gov/media/webcam/view.htm?id=81B46AD5-1DD8-B71B-0BFB3F36B5DDC6EF','https://www.nps.gov/aboutus/disclaimer.htm','Source: National Park Service. No claim to original U.S. Government works. NPS does not endorse Jalwa.',array['www.nps.gov','home.nps.gov'],300,7200,'PUBLIC_DOMAIN_NPS_CURRENT_IMAGE',true,true,'Official NPS-hosted webcam and disclaimer reviewed 2026-08-01.','Current image only; preserve source credit.'),

('nih-videocast','nih-videocast','NIH VideoCast','این آئی ایچ ویڈیو کاسٹ','Official National Institutes of Health live scientific events. Inline use remains event-specific because guest material may retain copyright.','nih','official_live_link','external_link','https://videocast.nih.gov/','https://www.nlm.nih.gov/web_policies.html','Source: National Institutes of Health. NIH does not endorse Jalwa.',array['videocast.nih.gov','www.nih.gov','nih.gov','www.nlm.nih.gov','nlm.nih.gov'],900,86400,'US_GOVERNMENT_EVENT_FILTERED_LINK',false,false,'NIH/NLM policy reviewed 2026-08-01. Government works may be reusable, but guest presentations and slides can retain copyright; this record approves only the official schedule link.','No inline event playback until the event page affirmatively identifies the work as a U.S. Government work and excludes third-party restrictions.'),
('fda-advisory-committee-live','fda-advisory-committee-live','FDA Advisory Committee Live','ایف ڈی اے مشاورتی کمیٹی براہ راست','Official U.S. Food and Drug Administration advisory-committee calendar and webcast access.','fda','official_live_link','external_link','https://www.fda.gov/advisory-committees/advisory-committee-calendar','https://www.fda.gov/about-fda/about-website/website-policies','Source: U.S. Food and Drug Administration. FDA does not endorse Jalwa.',array['www.fda.gov','fda.gov'],900,86400,'US_GOVERNMENT_EVENT_FILTERED_LINK',false,false,'FDA website policy and advisory-committee calendar reviewed 2026-08-01. Company submissions, guest slides and marks may retain rights.','Official-link only. Do not use the FDA logo or reproduce company materials.'),
('sec-public-meetings','sec-public-meetings','SEC Public Meetings','ایس ای سی عوامی اجلاس','Official U.S. Securities and Exchange Commission public-meeting and event schedule.','sec','official_live_link','external_link','https://www.sec.gov/newsroom/meetings-events','https://www.sec.gov/about/privacy-information','Source: U.S. Securities and Exchange Commission. The SEC does not endorse Jalwa.',array['www.sec.gov','sec.gov'],900,86400,'US_GOVERNMENT_EVENT_FILTERED_LINK',false,false,'Official SEC meetings/events page reviewed 2026-08-01. Link-only delivery avoids third-party speakers and presentation materials.','No inline playback without event-level rights review.'),
('fcc-open-meetings','fcc-open-meetings','FCC Open Meetings and Workshops','ایف سی سی کھلے اجلاس اور ورکشاپس','Official Federal Communications Commission live meeting and workshop coverage.','fcc','official_live_link','external_link','https://www.fcc.gov/live','https://www.fcc.gov/encyclopedia/website-policies-notices','Source: Federal Communications Commission. The FCC does not endorse Jalwa.',array['www.fcc.gov','fcc.gov'],900,86400,'US_GOVERNMENT_EVENT_FILTERED_LINK',false,false,'FCC live page and agency notices reviewed 2026-08-01. Official-link delivery only because external presenters may retain rights.','No inline playback or logo use without event-specific clearance.'),
('europe-by-satellite-ebs','europe-by-satellite-ebs','Europe by Satellite — EbS','یورپ بائی سیٹلائٹ ای بی ایس','Official European Commission EbS live audiovisual service. Jalwa opens the official ad-free service and does not restream it.','european_commission','official_live_link','external_link','https://audiovisual.ec.europa.eu/en/ebs/live/1','https://commission.europa.eu/legal-notice_en','© European Union, 2026 — Source: European Commission Audiovisual Service. No endorsement of Jalwa is implied.',array['audiovisual.ec.europa.eu','ec.europa.eu','commission.europa.eu'],900,86400,'EU_CC_BY_4_OFFICIAL_LINK',false,false,'European Commission legal notice and EbS service reviewed 2026-08-01. EU-owned content is generally CC BY 4.0 unless otherwise indicated, but individual third-party material remains excluded.','Official ad-free link only. No inline player until item-level ownership and attribution are confirmed.'),
('europe-by-satellite-ebs-plus','europe-by-satellite-ebs-plus','Europe by Satellite — EbS+','یورپ بائی سیٹلائٹ ای بی ایس پلس','Official European Commission EbS+ live audiovisual service. Jalwa opens the official ad-free service and does not restream it.','european_commission','official_live_link','external_link','https://audiovisual.ec.europa.eu/en/ebs/live/2','https://commission.europa.eu/legal-notice_en','© European Union, 2026 — Source: European Commission Audiovisual Service. No endorsement of Jalwa is implied.',array['audiovisual.ec.europa.eu','ec.europa.eu','commission.europa.eu'],900,86400,'EU_CC_BY_4_OFFICIAL_LINK',false,false,'European Commission legal notice and EbS+ service reviewed 2026-08-01. Link-only approval protects third-party exceptions.','Official ad-free link only. Preserve attribution and no endorsement.'),
('us-house-floorcast','us-house-floorcast','U.S. House FloorCast','امریکی ایوان نمائندگان فلور کاسٹ','Official U.S. House floor proceedings. This entry is official-link only and must remain free of commercial sponsorship around the source.','us_house','official_live_link','external_link','https://live.house.gov/','https://www.house.gov/website-information/content','Source: U.S. House of Representatives. The House does not endorse Jalwa.',array['live.house.gov','www.house.gov','house.gov'],900,86400,'US_HOUSE_OFFICIAL_LINK_AD_FREE',false,false,'Official House FloorCast reviewed 2026-08-01. Congressional recording and sponsorship restrictions require official-link and ad-free treatment.','Do not place ads, sponsorship or commercial endorsements adjacent to the source action. No inline reuse under this record.'),
('us-senate-floor-webcast','us-senate-floor-webcast','U.S. Senate Floor Webcast','امریکی سینیٹ فلور ویب کاسٹ','Official U.S. Senate floor webcast and daily proceedings schedule.','us_senate','official_live_link','external_link','https://www.senate.gov/floor/','https://www.senate.gov/general/copyright.htm','Source: United States Senate. The Senate does not endorse Jalwa.',array['www.senate.gov','senate.gov'],900,86400,'US_SENATE_OFFICIAL_LINK_ONLY',false,false,'Official Senate floor webcast and copyright page reviewed 2026-08-01. Link-only approval pending any broader reuse determination.','No inline playback, commercial sponsorship or implied endorsement under this record.');

insert into public.content_items(
  slug,content_type,hosting_mode,access_level,status,title_en,title_ur,description_en,
  primary_category_id,language,audience,sensitivity,is_featured
)
select i.slug,'live',i.hosting_mode,'public','editorial_review',i.title,i.title_ur,i.description,c.id,
  'multi','general','standard',false
from open_government_live_inventory i
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
from open_government_live_inventory i
where c.slug=i.slug and c.status in ('draft','rights_review','unavailable');

insert into public.playback_sources(content_id,provider,provider_content_id,external_url,format,is_primary,status)
select c.id,i.provider::public.source_provider,i.source_key,i.source_url,'external',true,'active'
from open_government_live_inventory i
join public.content_items c on c.slug=i.slug
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
select p.id,i.source_key,i.adapter,i.source_url,i.terms_url,i.allowed_hosts,
  case when i.adapter='public_domain_live_image' then 'current_image' else 'official_link' end,
  i.refresh_seconds,i.freshness_seconds,true,i.attribution,
  timestamptz '2026-08-01 12:27:00+00',timestamptz '2026-10-30 12:27:00+00',false,'content-operations'
from open_government_live_inventory i
join public.playback_sources p
  on p.provider=i.provider::public.source_provider and p.provider_content_id=i.source_key
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
  enabled=false,
  operations_owner=excluded.operations_owner;

insert into public.rights_records(
  content_id,source_url,creator,licence_code,attribution_text,evidence_url,evidence_note,
  takedown_contact,commercial_use_confirmed,modification_confirmed,self_hosting_confirmed,
  embedding_confirmed,status,review_notes,verified_at
)
select c.id,i.source_url,
  case i.provider
    when 'dvids' then 'Defense Visual Information Distribution Service'
    when 'nps' then 'National Park Service'
    when 'nasa' then 'NASA'
    when 'nih' then 'National Institutes of Health'
    when 'fda' then 'U.S. Food and Drug Administration'
    when 'sec' then 'U.S. Securities and Exchange Commission'
    when 'fcc' then 'Federal Communications Commission'
    when 'european_commission' then 'European Commission'
    when 'us_house' then 'U.S. House of Representatives'
    else 'United States Senate'
  end,
  i.licence_code,i.attribution,i.terms_url,i.evidence_note,
  'Jalwa content operations',i.commercial_use_confirmed,false,i.self_hosting_confirmed,false,
  'approved',i.review_notes,timestamptz '2026-08-01 12:27:00+00'
from open_government_live_inventory i
join public.content_items c on c.slug=i.slug
where not exists (
  select 1 from public.rights_records r where r.content_id=c.id and r.source_url=i.source_url
);

update public.rights_records r
set licence_code=i.licence_code,
    attribution_text=i.attribution,
    evidence_url=i.terms_url,
    evidence_note=i.evidence_note,
    takedown_contact='Jalwa content operations',
    commercial_use_confirmed=i.commercial_use_confirmed,
    modification_confirmed=false,
    self_hosting_confirmed=i.self_hosting_confirmed,
    embedding_confirmed=false,
    expires_at=null,
    status='approved',
    review_notes=i.review_notes,
    verified_at=timestamptz '2026-08-01 12:27:00+00'
from open_government_live_inventory i
join public.content_items c on c.slug=i.slug
where r.content_id=c.id and r.source_url=i.source_url;

insert into public.playback_source_health(
  playback_source_id,status,availability,consecutive_failures,checked_at,message,availability_reason,terms_review_due
)
select p.id,'degraded','degraded',0,now(),
  'Approved source is installed and awaiting controlled activation.',
  'Approved source is installed and awaiting controlled activation.',false
from open_government_live_inventory i
join public.playback_sources p
  on p.provider=i.provider::public.source_provider and p.provider_content_id=i.source_key
on conflict(playback_source_id) do update set
  status='degraded', availability='degraded', consecutive_failures=0, checked_at=now(),
  message='Approved source is installed and awaiting controlled activation.',
  availability_reason='Approved source is installed and awaiting controlled activation.',
  terms_review_due=false;

do $$
declare
  v_items integer;
  v_configs integer;
  v_rights integer;
  v_images integer;
  v_links integer;
begin
  select count(*) into v_items from public.content_items c join open_government_live_inventory i on i.slug=c.slug;
  select count(*) into v_configs
    from public.live_source_configs l
    join public.playback_sources p on p.id=l.playback_source_id
    join public.content_items c on c.id=p.content_id
    join open_government_live_inventory i on i.slug=c.slug and i.source_key=l.source_key
    where l.enabled=false and l.rights_verified_at=timestamptz '2026-08-01 12:27:00+00'
      and l.next_review_at=timestamptz '2026-10-30 12:27:00+00';
  select count(*) into v_rights
    from public.rights_records r join public.content_items c on c.id=r.content_id
    join open_government_live_inventory i on i.slug=c.slug
    where r.status='approved' and r.embedding_confirmed=false
      and r.self_hosting_confirmed=i.self_hosting_confirmed;
  select count(*) into v_images
    from public.content_items c join open_government_live_inventory i on i.slug=c.slug
    where i.adapter='public_domain_live_image' and c.hosting_mode='self_host_open';
  select count(*) into v_links
    from public.content_items c join open_government_live_inventory i on i.slug=c.slug
    where i.adapter='official_live_link' and c.hosting_mode='external_link';

  if v_items <> 31 then raise exception 'Open-government live inventory is incomplete'; end if;
  if v_configs <> 31 then raise exception 'Open-government live configurations are incomplete'; end if;
  if v_rights <> 31 then raise exception 'Open-government live rights records are incomplete'; end if;
  if v_images <> 15 then raise exception 'NPS current-image hosting modes are incorrect'; end if;
  if v_links <> 16 then raise exception 'Event and institutional sources must remain official-link only'; end if;
end $$;

commit;
