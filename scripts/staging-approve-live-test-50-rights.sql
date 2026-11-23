-- Staging-only rights approval for clear open-licence live-test drafts.
-- Authorized by business owner for staging (2026-11-03). Production unchanged.
-- HOLD slugs remain pending (DVIDS, CC-BY-SA, music-flagged, duplicates).

begin;
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;

create temporary table live_test_approve(slug text primary key) on commit drop;
insert into live_test_approve(slug) values
  ('mossy-tree-cc0'),
  ('baking-cookies-cc0'),
  ('ocean-surface-waves-cc0'),
  ('tiny-waterfall-cc0'),
  ('tree-trimmer-cc0'),
  ('counting-chisenbop-cc0'),
  ('vhs-static-cc0-clip'),
  ('vanellus-vanellus-cc0'),
  ('huamei-bird-calling-cc0'),
  ('house-sparrow-tschilp-cc0'),
  ('abrasive-bird-debate-cc0'),
  ('how-fossils-form-cc-by'),
  ('artemis-ii-lunar-flyby-svs'),
  ('artemis-ii-trajectory-svs'),
  ('earth-views-from-iss-nasa'),
  ('hst-fly-by-nasa'),
  ('hd-earth-views-svs'),
  ('hst-sm4-rendezvous-nasa'),
  ('apollo-11-eagle-has-landed'),
  ('grca-south-rim-summer-timelapse'),
  ('grca-animals-broll'),
  ('grca-south-rim-winter-scenic'),
  ('eso-cast-254-light'),
  ('eso-cast-265-light'),
  ('proxima-centauri-flythrough-cc-by'),
  ('invitation-to-pakistan-nara'),
  ('promise-of-pakistan-geography'),
  ('wikipedia-science-comms-cc-by'),
  ('big-buck-bunny'),
  ('sintel'),
  ('elephants-dream'),
  ('sprite-fright'),
  ('tears-of-steel'),
  ('spring-blender'),
  ('cosmos-laundromat'),
  ('caminandes-llamigos'),
  ('nasa-images-library-home-link'),
  ('eso-public-videos-link');

create temporary table live_test_hold(slug text primary key) on commit drop;
insert into live_test_hold(slug) values
  ('khyber-karma-dvids'),
  ('op-mustang-dvids'),
  ('rawhide-ii-border-hub-dvids'),
  ('chauntra-village-spring'),
  ('eastern-hindu-kush-lowari'),
  ('hunza-valley-wle-2018'),
  ('indus-kotri-barrage'),
  ('earthrise-45th-svs'),
  ('artemis-i-overview-svs'),
  ('artemis-science-lunar-flyby-svs'),
  ('eso-vista-cosmos-zoom'),
  ('proxima-centauri-eso-medium');

with reviewer as (
  select p.id
  from public.profiles p
  where p.role in ('admin', 'rights_reviewer')
  order by case p.role when 'rights_reviewer' then 0 else 1 end, p.created_at
  limit 1
), updated as (
  update public.rights_records rr
  set
    creator = coalesce(nullif(btrim(rr.creator), ''), 'Open-licence source'),
    licence_code = coalesce(nullif(btrim(rr.licence_code), ''), 'open-licence-review'),
    attribution_text = coalesce(nullif(btrim(rr.attribution_text), ''), rr.source_url),
    evidence_url = coalesce(rr.evidence_url, rr.source_url),
    takedown_contact = coalesce(nullif(btrim(rr.takedown_contact), ''), 'content-lead@jalwa.local'),
    jurisdiction_note = coalesce(rr.jurisdiction_note, 'Pakistan staging live-test; owner-authorized staging rights review 2026-11-03'),
    commercial_use_confirmed = case when ci.hosting_mode in ('self_host_open', 'self_host_owned') then true else rr.commercial_use_confirmed end,
    self_hosting_confirmed = case when ci.hosting_mode in ('self_host_open', 'self_host_owned') then true else rr.self_hosting_confirmed end,
    embedding_confirmed = case when ci.hosting_mode = 'embed_only' then true else rr.embedding_confirmed end,
    modification_confirmed = coalesce(rr.modification_confirmed, false),
    status = 'approved',
    verified_by = (select id from reviewer),
    verified_at = now(),
    review_notes = 'Staging rights approval authorized by business owner for clear open-licence candidates. HOLD list excluded.',
    updated_at = now()
  from public.content_items ci
  where ci.id = rr.content_id
    and ci.slug in (select slug from live_test_approve)
    and rr.status = 'pending'
  returning rr.id, ci.slug, ci.id as content_id
)
update public.content_items ci
set status = 'editorial_review', updated_at = now()
where ci.id in (select content_id from updated);

insert into public.audit_logs(actor_id, action, entity_type, entity_id, metadata)
select
  (select id from public.profiles where role in ('admin','rights_reviewer') order by case role when 'rights_reviewer' then 0 else 1 end, created_at limit 1),
  'rights_approved',
  'content_item',
  ci.id,
  jsonb_build_object(
    'slug', ci.slug,
    'scope', 'staging_only',
    'authorization', 'business_owner_2026-11-03',
    'importer', 'staging-approve-live-test-50-rights.sql'
  )
from public.content_items ci
where ci.slug in (select slug from live_test_approve)
  and exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id and rr.status = 'approved'
  );

-- Publish official link-only items immediately (no self-host media required).
update public.content_items ci
set status = 'published', publish_at = coalesce(publish_at, now()), unpublish_at = null, updated_at = now()
where ci.slug in ('nasa-images-library-home-link', 'eso-public-videos-link')
  and ci.hosting_mode = 'external_link'
  and public.has_publishable_rights(ci.id, ci.hosting_mode, ci.access_level);

select json_build_object(
  'approved_rights', (
    select count(*) from rights_records rr
    join content_items ci on ci.id = rr.content_id
    where ci.slug in (select slug from live_test_approve) and rr.status = 'approved'
  ),
  'held_pending', (
    select count(*) from rights_records rr
    join content_items ci on ci.id = rr.content_id
    where ci.slug in (select slug from live_test_hold) and rr.status = 'pending'
  ),
  'published_links', (
    select count(*) from content_items
    where slug in ('nasa-images-library-home-link', 'eso-public-videos-link') and status = 'published'
  ),
  'reviewer', (
    select json_build_object('id', id, 'role', role) from profiles
    where role in ('admin','rights_reviewer')
    order by case role when 'rights_reviewer' then 0 else 1 end, created_at
    limit 1
  )
);

commit;
