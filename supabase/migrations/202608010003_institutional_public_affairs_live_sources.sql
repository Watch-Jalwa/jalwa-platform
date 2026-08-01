-- Six institutional/public-affairs entries extend the approved live catalogue
-- from nine to fifteen user-facing entries. Inline playback is intentionally
-- not used here: European Parliament iframe codes are event-specific and the
-- United Nations requires written authorization for use of its footage.

begin;
alter type public.source_provider add value if not exists 'european_parliament';
alter type public.source_provider add value if not exists 'un_web_tv';
alter type public.live_delivery_adapter add value if not exists 'official_live_link';
commit;

begin;

alter table public.live_source_configs
  drop constraint if exists live_source_configs_expected_media_type_check;
alter table public.live_source_configs
  add constraint live_source_configs_expected_media_type_check
  check (expected_media_type in ('official_embed','current_image','official_link'));

create temporary table institutional_live_inventory (
  source_key text primary key,
  slug text not null unique,
  title text not null,
  title_ur text,
  description text not null,
  provider text not null,
  source_url text not null,
  terms_url text not null,
  attribution text not null,
  allowed_hosts text[] not null,
  commercial_use_confirmed boolean not null,
  licence_code text not null,
  evidence_note text not null,
  review_notes text not null
);

insert into institutional_live_inventory values
(
  'european-parliament-plenary',
  'european-parliament-plenary',
  'European Parliament Plenary',
  'یورپی پارلیمنٹ پلینری',
  'Official European Parliament plenary streaming agenda and multilingual coverage.',
  'european_parliament',
  'https://multimedia.europarl.europa.eu/en/webstreaming',
  'https://www.europarl.europa.eu/legal-notice/en',
  '© European Union, 2026 – Source: European Parliament. The European Parliament does not endorse Jalwa.',
  array['multimedia.europarl.europa.eu','www.europarl.europa.eu','europarl.europa.eu'],
  true,
  'EUROPEAN_PARLIAMENT_OFFICIAL_LINK',
  'European Parliament legal notice and Multimedia Centre reuse guidance reviewed on 2026-08-01. This record authorizes an attributed official-source link only; an event-specific iframe code must be recorded before inline playback.',
  'Keep the item public/free. Do not use Parliament logos as Jalwa branding. Do not edit or restream the source. Replace official-link delivery only after an event-specific iframe authorization is retained.'
),
(
  'european-parliament-committee-rooms',
  'european-parliament-committee-rooms',
  'European Parliament Committee Rooms',
  'یورپی پارلیمنٹ کمیٹی رومز',
  'Official schedule for public European Parliament committee meetings and simultaneous room streams.',
  'european_parliament',
  'https://www.europarl.europa.eu/committees/en/meetings/webstreaming',
  'https://www.europarl.europa.eu/legal-notice/en',
  '© European Union, 2026 – Source: European Parliament. The European Parliament does not endorse Jalwa.',
  array['multimedia.europarl.europa.eu','www.europarl.europa.eu','europarl.europa.eu'],
  true,
  'EUROPEAN_PARLIAMENT_OFFICIAL_LINK',
  'European Parliament legal notice, committee webstreaming page and Multimedia Centre guidance reviewed on 2026-08-01. This record authorizes an attributed official-source link only; meeting iframe codes are event-specific.',
  'Keep the item public/free. Do not imply endorsement. Do not restream or record meetings. Inline playback requires the exact official iframe authorization for the selected meeting.'
),
(
  'un-web-tv',
  'un-web-tv',
  'UN Web TV',
  'اقوام متحدہ ویب ٹی وی',
  'Official United Nations live schedule and on-demand meeting coverage.',
  'un_web_tv',
  'https://webtv.un.org/en',
  'https://webtv.un.org/en/copyright_use',
  'Source: United Nations Web TV. The United Nations does not endorse Jalwa.',
  array['webtv.un.org','media.un.org','www.un.org','un.org'],
  false,
  'UNITED_NATIONS_OFFICIAL_LINK_ONLY',
  'UN Web TV copyright guidance reviewed on 2026-08-01. UN footage is not public domain and requires written authorization and a licence agreement. This approval covers only a direct link to the official UN Web TV page.',
  'Never embed, reproduce, cache, download, transmit, restream, record or monetize UN footage under this record. Inline playback remains fail-closed until a written UN licence reference is retained.'
),
(
  'un-general-assembly',
  'un-general-assembly',
  'UN General Assembly',
  'اقوام متحدہ جنرل اسمبلی',
  'Official United Nations General Assembly meeting coverage and live schedule.',
  'un_web_tv',
  'https://webtv.un.org/en/search/categories/meetings-events/general-assembly',
  'https://webtv.un.org/en/copyright_use',
  'Source: United Nations Web TV. The United Nations does not endorse Jalwa.',
  array['webtv.un.org','media.un.org','www.un.org','un.org'],
  false,
  'UNITED_NATIONS_OFFICIAL_LINK_ONLY',
  'UN Web TV copyright guidance reviewed on 2026-08-01. This approval covers only a direct link to the official General Assembly category page; UN footage remains licensed material.',
  'No inline player, reproduction, caching, restreaming, recording or advertising overlay is permitted without a retained UN licence agreement.'
),
(
  'un-security-council',
  'un-security-council',
  'UN Security Council',
  'اقوام متحدہ سلامتی کونسل',
  'Official United Nations Security Council meeting coverage and live schedule.',
  'un_web_tv',
  'https://webtv.un.org/en/search/categories/meetings-events/security-council',
  'https://webtv.un.org/en/copyright_use',
  'Source: United Nations Web TV. The United Nations does not endorse Jalwa.',
  array['webtv.un.org','media.un.org','www.un.org','un.org'],
  false,
  'UNITED_NATIONS_OFFICIAL_LINK_ONLY',
  'UN Web TV copyright guidance reviewed on 2026-08-01. This approval covers only a direct link to the official Security Council category page; UN footage remains licensed material.',
  'No inline player, reproduction, caching, restreaming, recording or advertising overlay is permitted without a retained UN licence agreement.'
),
(
  'un-human-rights-council',
  'un-human-rights-council',
  'UN Human Rights Council',
  'اقوام متحدہ انسانی حقوق کونسل',
  'Official United Nations Human Rights Council meeting coverage and live schedule.',
  'un_web_tv',
  'https://webtv.un.org/en/search/categories/meetings-events/human-rights-council',
  'https://webtv.un.org/en/copyright_use',
  'Source: United Nations Web TV. The United Nations does not endorse Jalwa.',
  array['webtv.un.org','media.un.org','www.un.org','un.org'],
  false,
  'UNITED_NATIONS_OFFICIAL_LINK_ONLY',
  'UN Web TV copyright guidance reviewed on 2026-08-01. This approval covers only a direct link to the official Human Rights Council category page; UN footage remains licensed material.',
  'No inline player, reproduction, caching, restreaming, recording or advertising overlay is permitted without a retained UN licence agreement.'
);

insert into public.content_items(
  slug,content_type,hosting_mode,access_level,status,title_en,title_ur,description_en,
  primary_category_id,language,audience,sensitivity,is_featured
)
select i.slug,'live','external_link','public','editorial_review',i.title,i.title_ur,i.description,c.id,
  'multi','general','standard',false
from institutional_live_inventory i
join public.categories c on c.slug='live'
on conflict(slug) do update set
  title_en=excluded.title_en,
  title_ur=excluded.title_ur,
  description_en=excluded.description_en,
  content_type='live',
  hosting_mode='external_link',
  access_level='public',
  primary_category_id=excluded.primary_category_id;

update public.content_items c
set status='editorial_review', unpublish_at=null
from institutional_live_inventory i
where c.slug=i.slug and c.status in ('draft','rights_review','unavailable');

insert into public.playback_sources(content_id,provider,provider_content_id,external_url,format,is_primary,status)
select c.id,i.provider::public.source_provider,i.source_key,i.source_url,'external',true,'active'
from institutional_live_inventory i
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
select p.id,i.source_key,'official_live_link',i.source_url,i.terms_url,i.allowed_hosts,
  'official_link',900,86400,true,i.attribution,
  timestamptz '2026-08-01 11:07:00+00',timestamptz '2026-10-30 11:07:00+00',false,'content-operations'
from institutional_live_inventory i
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
  case i.provider when 'european_parliament' then 'European Parliament' else 'United Nations' end,
  i.licence_code,i.attribution,i.terms_url,i.evidence_note,
  'Jalwa content operations',i.commercial_use_confirmed,false,false,false,
  'approved',i.review_notes,timestamptz '2026-08-01 11:07:00+00'
from institutional_live_inventory i
join public.content_items c on c.slug=i.slug
where not exists (
  select 1 from public.rights_records r where r.content_id=c.id and r.source_url=i.source_url
);

update public.rights_records r
set
  creator=case i.provider when 'european_parliament' then 'European Parliament' else 'United Nations' end,
  licence_code=i.licence_code,
  attribution_text=i.attribution,
  evidence_url=i.terms_url,
  evidence_note=i.evidence_note,
  takedown_contact='Jalwa content operations',
  commercial_use_confirmed=i.commercial_use_confirmed,
  modification_confirmed=false,
  self_hosting_confirmed=false,
  embedding_confirmed=false,
  expires_at=null,
  status='approved',
  review_notes=i.review_notes,
  verified_at=timestamptz '2026-08-01 11:07:00+00'
from institutional_live_inventory i
join public.content_items c on c.slug=i.slug
where r.content_id=c.id and r.source_url=i.source_url;

insert into public.playback_source_health(
  playback_source_id,status,availability,consecutive_failures,checked_at,message,availability_reason,terms_review_due
)
select p.id,'degraded','degraded',0,now(),
  'Approved official-source link is installed and awaiting controlled activation.',
  'Approved official-source link is installed and awaiting controlled activation.',false
from institutional_live_inventory i
join public.playback_sources p
  on p.provider=i.provider::public.source_provider and p.provider_content_id=i.source_key
on conflict(playback_source_id) do update set
  status='degraded',
  availability='degraded',
  consecutive_failures=0,
  checked_at=now(),
  message='Approved official-source link is installed and awaiting controlled activation.',
  availability_reason='Approved official-source link is installed and awaiting controlled activation.',
  terms_review_due=false;

commit;

do $$
declare
  v_items integer;
  v_configs integer;
  v_rights integer;
  v_links integer;
begin
  select count(*) into v_items
  from public.content_items c
  where c.slug in (
    'european-parliament-plenary','european-parliament-committee-rooms','un-web-tv',
    'un-general-assembly','un-security-council','un-human-rights-council'
  );

  select count(*) into v_configs
  from public.live_source_configs
  where source_key in (
    'european-parliament-plenary','european-parliament-committee-rooms','un-web-tv',
    'un-general-assembly','un-security-council','un-human-rights-council'
  ) and delivery_adapter='official_live_link'
    and expected_media_type='official_link'
    and enabled=false
    and rights_verified_at=timestamptz '2026-08-01 11:07:00+00'
    and next_review_at=timestamptz '2026-10-30 11:07:00+00';

  select count(*) into v_rights
  from public.rights_records r
  join public.content_items c on c.id=r.content_id
  where c.slug in (
    'european-parliament-plenary','european-parliament-committee-rooms','un-web-tv',
    'un-general-assembly','un-security-council','un-human-rights-council'
  ) and r.status='approved' and r.embedding_confirmed=false and r.self_hosting_confirmed=false;

  select count(*) into v_links
  from public.content_items c
  where c.slug in (
    'european-parliament-plenary','european-parliament-committee-rooms','un-web-tv',
    'un-general-assembly','un-security-council','un-human-rights-council'
  ) and c.hosting_mode='external_link';

  if v_items <> 6 then raise exception 'Institutional live inventory is incomplete'; end if;
  if v_configs <> 6 then raise exception 'Institutional live configurations are incomplete'; end if;
  if v_rights <> 6 then raise exception 'Institutional link-only rights records are incomplete'; end if;
  if v_links <> 6 then raise exception 'Institutional sources must remain external-link only'; end if;
end $$;
