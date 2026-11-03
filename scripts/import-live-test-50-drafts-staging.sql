-- Generated live-test-50 draft intake for staging only.
-- Draft + pending rights only. Never publishes. Never touches production.
begin;
select set_config('request.jwt.claim.role','service_role',true);
set local role service_role;

-- mossy-tree-cc0
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'mossy-tree-cc0', 'short'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Mossy tree close-up', 'تعلیمی مواد', 'Mossy tree closeup', 'Live-test candidate ITEM-001: Mossy tree close-up by Elvis Deane. Licence candidate CC0-1.0. CC0 Commons File page; verify current licence notice.', 'تعلیمی مواد', 'Mossy tree closeup',
    (select id from public.categories where slug='learn'), 'en', 26, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'wikimedia'::public.source_provider, 'item-001', 'https://commons.wikimedia.org/wiki/File:Mossy_Tree_CC0.webm', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'mossy-tree-cc0', 'source_url', 'https://commons.wikimedia.org/wiki/File:Mossy_Tree_CC0.webm', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://commons.wikimedia.org/wiki/File:Mossy_Tree_CC0.webm', 'Elvis Deane', 'CC0-1.0', 'Elvis Deane — CC0-1.0 — https://commons.wikimedia.org/wiki/File:Mossy_Tree_CC0.webm', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://commons.wikimedia.org/wiki/File:Mossy_Tree_CC0.webm', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'mossy-tree-cc0'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Mossy_Tree_CC0.webm'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Mossy_Tree_CC0.webm'
      and rr.status = 'pending'
  );


-- baking-cookies-cc0
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'baking-cookies-cc0', 'short'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Baking cookies', 'تعلیمی مواد', 'Baking cookies', 'Live-test candidate ITEM-002: Baking cookies by Robert Cole. Licence candidate CC0-1.0. CC0 Commons File page.', 'تعلیمی مواد', 'Baking cookies',
    (select id from public.categories where slug='learn'), 'en', 20, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'wikimedia'::public.source_provider, 'item-002', 'https://commons.wikimedia.org/wiki/File:Baking_cookies.ogv', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'baking-cookies-cc0', 'source_url', 'https://commons.wikimedia.org/wiki/File:Baking_cookies.ogv', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://commons.wikimedia.org/wiki/File:Baking_cookies.ogv', 'Robert Cole', 'CC0-1.0', 'Robert Cole — CC0-1.0 — https://commons.wikimedia.org/wiki/File:Baking_cookies.ogv', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://commons.wikimedia.org/wiki/File:Baking_cookies.ogv', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'baking-cookies-cc0'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Baking_cookies.ogv'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Baking_cookies.ogv'
      and rr.status = 'pending'
  );


-- ocean-surface-waves-cc0
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'ocean-surface-waves-cc0', 'short'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Ocean surface waves', 'تعلیمی مواد', 'Ocean surface waves', 'Live-test candidate ITEM-003: Ocean surface waves by Mostafameraji. Licence candidate CC0-1.0. CC0 Commons File page; own-work claim on File page.', 'تعلیمی مواد', 'Ocean surface waves',
    (select id from public.categories where slug='learn'), 'en', 21, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'wikimedia'::public.source_provider, 'item-003', 'https://commons.wikimedia.org/wiki/File:Ocean_surface_waves.ogv', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'ocean-surface-waves-cc0', 'source_url', 'https://commons.wikimedia.org/wiki/File:Ocean_surface_waves.ogv', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://commons.wikimedia.org/wiki/File:Ocean_surface_waves.ogv', 'Mostafameraji', 'CC0-1.0', 'Mostafameraji — CC0-1.0 — https://commons.wikimedia.org/wiki/File:Ocean_surface_waves.ogv', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://commons.wikimedia.org/wiki/File:Ocean_surface_waves.ogv', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'ocean-surface-waves-cc0'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Ocean_surface_waves.ogv'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Ocean_surface_waves.ogv'
      and rr.status = 'pending'
  );


-- tiny-waterfall-cc0
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'tiny-waterfall-cc0', 'short'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Tiny waterfall', 'تعلیمی مواد', 'Tiny waterfall', 'Live-test candidate ITEM-004: Tiny waterfall by leeroy LIFEOFVIDS. Licence candidate CC0-1.0. File lists CC0 and CC BY 3.0; prefer CC0 path after human check.', 'تعلیمی مواد', 'Tiny waterfall',
    (select id from public.categories where slug='learn'), 'en', 13, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'wikimedia'::public.source_provider, 'item-004', 'https://commons.wikimedia.org/wiki/File:Tiny_Water_Fall-HD.ogv', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'tiny-waterfall-cc0', 'source_url', 'https://commons.wikimedia.org/wiki/File:Tiny_Water_Fall-HD.ogv', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://commons.wikimedia.org/wiki/File:Tiny_Water_Fall-HD.ogv', 'leeroy LIFEOFVIDS', 'CC0-1.0', 'leeroy LIFEOFVIDS — CC0-1.0 — https://commons.wikimedia.org/wiki/File:Tiny_Water_Fall-HD.ogv', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://commons.wikimedia.org/wiki/File:Tiny_Water_Fall-HD.ogv', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'tiny-waterfall-cc0'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Tiny_Water_Fall-HD.ogv'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Tiny_Water_Fall-HD.ogv'
      and rr.status = 'pending'
  );


-- how-fossils-form-cc-by
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'how-fossils-form-cc-by', 'short'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'How fossils form', 'تعلیمی مواد', 'How fossils form', 'Live-test candidate ITEM-005: How fossils form by ZDF / Schule. Licence candidate CC-BY-4.0. CC BY 4.0; attribution + no endorsement obligations; educational science short.', 'تعلیمی مواد', 'How fossils form',
    (select id from public.categories where slug='learn'), 'en', 165, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'wikimedia'::public.source_provider, 'item-005', 'https://commons.wikimedia.org/wiki/File:Wie_entstehen_Fossilien_(CC_by_4.0).webm', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'how-fossils-form-cc-by', 'source_url', 'https://commons.wikimedia.org/wiki/File:Wie_entstehen_Fossilien_(CC_by_4.0).webm', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://commons.wikimedia.org/wiki/File:Wie_entstehen_Fossilien_(CC_by_4.0).webm', 'ZDF / Schule', 'CC-BY-4.0', 'ZDF / Schule — CC-BY-4.0 — https://commons.wikimedia.org/wiki/File:Wie_entstehen_Fossilien_(CC_by_4.0).webm', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://commons.wikimedia.org/wiki/File:Wie_entstehen_Fossilien_(CC_by_4.0).webm', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'how-fossils-form-cc-by'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Wie_entstehen_Fossilien_(CC_by_4.0).webm'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Wie_entstehen_Fossilien_(CC_by_4.0).webm'
      and rr.status = 'pending'
  );


-- tree-trimmer-cc0
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'tree-trimmer-cc0', 'short'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Tree trimmer', 'تعلیمی مواد', 'Tree trimmer', 'Live-test candidate ITEM-006: Tree trimmer by Wikideas1. Licence candidate CC0-1.0. CC0 own-work WebM; short practical clip.', 'تعلیمی مواد', 'Tree trimmer',
    (select id from public.categories where slug='learn'), 'en', 15, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'wikimedia'::public.source_provider, 'item-006', 'https://commons.wikimedia.org/wiki/File:Tree_trimmer.webm', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'tree-trimmer-cc0', 'source_url', 'https://commons.wikimedia.org/wiki/File:Tree_trimmer.webm', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://commons.wikimedia.org/wiki/File:Tree_trimmer.webm', 'Wikideas1', 'CC0-1.0', 'Wikideas1 — CC0-1.0 — https://commons.wikimedia.org/wiki/File:Tree_trimmer.webm', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://commons.wikimedia.org/wiki/File:Tree_trimmer.webm', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'tree-trimmer-cc0'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Tree_trimmer.webm'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Tree_trimmer.webm'
      and rr.status = 'pending'
  );


-- artemis-ii-lunar-flyby-svs
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'artemis-ii-lunar-flyby-svs', 'short'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Simulated Artemis II lunar flyby', 'تعلیمی مواد', 'Simulated Artemis II lunar flyby', 'Live-test candidate ITEM-007: Simulated Artemis II lunar flyby by NASA/GSFC Scientific Visualization Studio. Licence candidate NASA-media-guidelines. NASA SVS; confirm NASA-created (no third-party credit) and mute/remove any licensed music if present.', 'تعلیمی مواد', 'Simulated Artemis II lunar flyby',
    (select id from public.categories where slug='learn'), 'en', 70, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'nasa'::public.source_provider, 'item-007', 'https://svs.gsfc.nasa.gov/5536', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'artemis-ii-lunar-flyby-svs', 'source_url', 'https://svs.gsfc.nasa.gov/5536', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://svs.gsfc.nasa.gov/5536', 'NASA/GSFC Scientific Visualization Studio', 'NASA-media-guidelines', 'NASA/GSFC Scientific Visualization Studio — NASA-media-guidelines — https://svs.gsfc.nasa.gov/5536', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://svs.gsfc.nasa.gov/5536', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'artemis-ii-lunar-flyby-svs'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://svs.gsfc.nasa.gov/5536'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://svs.gsfc.nasa.gov/5536'
      and rr.status = 'pending'
  );


-- artemis-ii-trajectory-svs
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'artemis-ii-trajectory-svs', 'short'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Artemis II nominal trajectory', 'تعلیمی مواد', 'Artemis II nominal trajectory', 'Live-test candidate ITEM-008: Artemis II nominal trajectory by NASA/GSFC Scientific Visualization Studio. Licence candidate NASA-media-guidelines. NASA SVS public-domain visualization unless page notes otherwise.', 'تعلیمی مواد', 'Artemis II nominal trajectory',
    (select id from public.categories where slug='learn'), 'en', 60, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'nasa'::public.source_provider, 'item-008', 'https://svs.gsfc.nasa.gov/5610/', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'artemis-ii-trajectory-svs', 'source_url', 'https://svs.gsfc.nasa.gov/5610/', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://svs.gsfc.nasa.gov/5610/', 'NASA/GSFC Scientific Visualization Studio', 'NASA-media-guidelines', 'NASA/GSFC Scientific Visualization Studio — NASA-media-guidelines — https://svs.gsfc.nasa.gov/5610/', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://svs.gsfc.nasa.gov/5610/', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'artemis-ii-trajectory-svs'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://svs.gsfc.nasa.gov/5610/'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://svs.gsfc.nasa.gov/5610/'
      and rr.status = 'pending'
  );


-- earthrise-45th-svs
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'earthrise-45th-svs', 'short'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Earthrise: The 45th Anniversary', 'تعلیمی مواد', 'Earthrise The 45th Anniversary', 'Live-test candidate ITEM-009: Earthrise: The 45th Anniversary by NASA/GSFC Scientific Visualization Studio. Licence candidate NASA-media-guidelines. Prefer silent visualization cut if narration/music clearance is unclear; NASA-created visualization.', 'تعلیمی مواد', 'Earthrise The 45th Anniversary',
    (select id from public.categories where slug='learn'), 'en', 180, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'nasa'::public.source_provider, 'item-009', 'https://svs.gsfc.nasa.gov/4129/', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'earthrise-45th-svs', 'source_url', 'https://svs.gsfc.nasa.gov/4129/', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://svs.gsfc.nasa.gov/4129/', 'NASA/GSFC Scientific Visualization Studio', 'NASA-media-guidelines', 'NASA/GSFC Scientific Visualization Studio — NASA-media-guidelines — https://svs.gsfc.nasa.gov/4129/', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://svs.gsfc.nasa.gov/4129/', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'earthrise-45th-svs'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://svs.gsfc.nasa.gov/4129/'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://svs.gsfc.nasa.gov/4129/'
      and rr.status = 'pending'
  );


-- eso-cast-254-light
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'eso-cast-254-light', 'short'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'ESOcast 254 Light — white-dwarf explosions', 'تعلیمی مواد', 'ESOcast 254 Light  whitedwarf explosions', 'Live-test candidate ITEM-010: ESOcast 254 Light — white-dwarf explosions by European Southern Observatory. Licence candidate CC-BY-4.0. Exact ESO video page; Commons mirror File:ESOcast_254_Light.webm; credit ESO; exclude ESO logo misuse; check music terms.', 'تعلیمی مواد', 'ESOcast 254 Light  whitedwarf explosions',
    (select id from public.categories where slug='learn'), 'en', 89, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'other'::public.source_provider, 'item-010', 'https://www.eso.org/public/videos/eso2207a/', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'eso-cast-254-light', 'source_url', 'https://www.eso.org/public/videos/eso2207a/', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://www.eso.org/public/videos/eso2207a/', 'European Southern Observatory', 'CC-BY-4.0', 'European Southern Observatory — CC-BY-4.0 — https://www.eso.org/public/videos/eso2207a/', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://www.eso.org/public/videos/eso2207a/', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'eso-cast-254-light'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://www.eso.org/public/videos/eso2207a/'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://www.eso.org/public/videos/eso2207a/'
      and rr.status = 'pending'
  );


-- counting-chisenbop-cc0
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'counting-chisenbop-cc0', 'short'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Counting from 1 to 20 in Chisenbop', 'تعلیمی مواد', 'Counting from 1 to 20 in Chisenbop', 'Live-test candidate ITEM-011: Counting from 1 to 20 in Chisenbop by Axlrosen. Licence candidate CC0-1.0. CC0 own-work educational short.', 'تعلیمی مواد', 'Counting from 1 to 20 in Chisenbop',
    (select id from public.categories where slug='learn'), 'en', 16, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'wikimedia'::public.source_provider, 'item-011', 'https://commons.wikimedia.org/wiki/File:Counting_from_1_to_20_in_Chisenbop.webm', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'counting-chisenbop-cc0', 'source_url', 'https://commons.wikimedia.org/wiki/File:Counting_from_1_to_20_in_Chisenbop.webm', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://commons.wikimedia.org/wiki/File:Counting_from_1_to_20_in_Chisenbop.webm', 'Axlrosen', 'CC0-1.0', 'Axlrosen — CC0-1.0 — https://commons.wikimedia.org/wiki/File:Counting_from_1_to_20_in_Chisenbop.webm', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://commons.wikimedia.org/wiki/File:Counting_from_1_to_20_in_Chisenbop.webm', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'counting-chisenbop-cc0'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Counting_from_1_to_20_in_Chisenbop.webm'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Counting_from_1_to_20_in_Chisenbop.webm'
      and rr.status = 'pending'
  );


-- vhs-static-cc0-clip
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'vhs-static-cc0-clip', 'short'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Analog television static excerpt', 'تعلیمی مواد', 'Analog television static excerpt', 'Live-test candidate ITEM-012: Analog television static excerpt by Caleb Minear. Licence candidate CC0-1.0. Import a short editorial trim only after rights OK — do not count multiple trims as separate items.', 'تعلیمی مواد', 'Analog television static excerpt',
    (select id from public.categories where slug='learn'), 'en', 45, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'wikimedia'::public.source_provider, 'item-012', 'https://commons.wikimedia.org/wiki/File:FREE_real_VHS_static.webm', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'vhs-static-cc0-clip', 'source_url', 'https://commons.wikimedia.org/wiki/File:FREE_real_VHS_static.webm', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://commons.wikimedia.org/wiki/File:FREE_real_VHS_static.webm', 'Caleb Minear', 'CC0-1.0', 'Caleb Minear — CC0-1.0 — https://commons.wikimedia.org/wiki/File:FREE_real_VHS_static.webm', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://commons.wikimedia.org/wiki/File:FREE_real_VHS_static.webm', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'vhs-static-cc0-clip'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:FREE_real_VHS_static.webm'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:FREE_real_VHS_static.webm'
      and rr.status = 'pending'
  );


-- earth-views-from-iss-nasa
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'earth-views-from-iss-nasa', 'short'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Earth Views from the ISS', 'تعلیمی مواد', 'Earth Views from the ISS', 'Live-test candidate ITEM-013: Earth Views from the ISS by NASA. Licence candidate NASA-media-guidelines. NASA Image and Video Library nasa_id NHQ_2019_0626_Earth Views from the ISS; confirm no third-party music.', 'تعلیمی مواد', 'Earth Views from the ISS',
    (select id from public.categories where slug='learn'), 'en', 120, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'nasa'::public.source_provider, 'item-013', 'https://images.nasa.gov/details/NHQ_2019_0626_Earth%20Views%20from%20the%20ISS', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'earth-views-from-iss-nasa', 'source_url', 'https://images.nasa.gov/details/NHQ_2019_0626_Earth%20Views%20from%20the%20ISS', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://images.nasa.gov/details/NHQ_2019_0626_Earth%20Views%20from%20the%20ISS', 'NASA', 'NASA-media-guidelines', 'NASA — NASA-media-guidelines — https://images.nasa.gov/details/NHQ_2019_0626_Earth%20Views%20from%20the%20ISS', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://images.nasa.gov/details/NHQ_2019_0626_Earth%20Views%20from%20the%20ISS', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'earth-views-from-iss-nasa'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://images.nasa.gov/details/NHQ_2019_0626_Earth%20Views%20from%20the%20ISS'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://images.nasa.gov/details/NHQ_2019_0626_Earth%20Views%20from%20the%20ISS'
      and rr.status = 'pending'
  );


-- hst-fly-by-nasa
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'hst-fly-by-nasa', 'short'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Hubble Space Telescope fly-by', 'تعلیمی مواد', 'Hubble Space Telescope flyby', 'Live-test candidate ITEM-014: Hubble Space Telescope fly-by by NASA/GSFC. Licence candidate NASA-media-guidelines. NASA-created HST visualization; nasa_id GSFC_20080520_HST_m10216_Whip_Pan.', 'تعلیمی مواد', 'Hubble Space Telescope flyby',
    (select id from public.categories where slug='learn'), 'en', 30, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'nasa'::public.source_provider, 'item-014', 'https://images.nasa.gov/details/GSFC_20080520_HST_m10216_Whip_Pan', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'hst-fly-by-nasa', 'source_url', 'https://images.nasa.gov/details/GSFC_20080520_HST_m10216_Whip_Pan', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://images.nasa.gov/details/GSFC_20080520_HST_m10216_Whip_Pan', 'NASA/GSFC', 'NASA-media-guidelines', 'NASA/GSFC — NASA-media-guidelines — https://images.nasa.gov/details/GSFC_20080520_HST_m10216_Whip_Pan', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://images.nasa.gov/details/GSFC_20080520_HST_m10216_Whip_Pan', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'hst-fly-by-nasa'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://images.nasa.gov/details/GSFC_20080520_HST_m10216_Whip_Pan'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://images.nasa.gov/details/GSFC_20080520_HST_m10216_Whip_Pan'
      and rr.status = 'pending'
  );


-- hd-earth-views-svs
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'hd-earth-views-svs', 'short'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'HD Earth Views from Space', 'تعلیمی مواد', 'HD Earth Views from Space', 'Live-test candidate ITEM-015: HD Earth Views from Space by NASA/GSFC Scientific Visualization Studio. Licence candidate NASA-media-guidelines. NASA SVS ISS/Shuttle Earth views compilation; select one distinct clip only.', 'تعلیمی مواد', 'HD Earth Views from Space',
    (select id from public.categories where slug='learn'), 'en', 90, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'nasa'::public.source_provider, 'item-015', 'https://svs.gsfc.nasa.gov/10766/', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'hd-earth-views-svs', 'source_url', 'https://svs.gsfc.nasa.gov/10766/', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://svs.gsfc.nasa.gov/10766/', 'NASA/GSFC Scientific Visualization Studio', 'NASA-media-guidelines', 'NASA/GSFC Scientific Visualization Studio — NASA-media-guidelines — https://svs.gsfc.nasa.gov/10766/', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://svs.gsfc.nasa.gov/10766/', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'hd-earth-views-svs'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://svs.gsfc.nasa.gov/10766/'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://svs.gsfc.nasa.gov/10766/'
      and rr.status = 'pending'
  );


-- artemis-i-overview-svs
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'artemis-i-overview-svs', 'short'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Artemis I overview visualization', 'تعلیمی مواد', 'Artemis I overview visualization', 'Live-test candidate ITEM-016: Artemis I overview visualization by NASA/GSFC Scientific Visualization Studio. Licence candidate NASA-media-guidelines. Page notes Epidemic Sound music — use video without licensed audio track if retained.', 'تعلیمی مواد', 'Artemis I overview visualization',
    (select id from public.categories where slug='learn'), 'en', 120, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'nasa'::public.source_provider, 'item-016', 'https://svs.gsfc.nasa.gov/14195', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'artemis-i-overview-svs', 'source_url', 'https://svs.gsfc.nasa.gov/14195', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://svs.gsfc.nasa.gov/14195', 'NASA/GSFC Scientific Visualization Studio', 'NASA-media-guidelines', 'NASA/GSFC Scientific Visualization Studio — NASA-media-guidelines — https://svs.gsfc.nasa.gov/14195', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://svs.gsfc.nasa.gov/14195', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'artemis-i-overview-svs'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://svs.gsfc.nasa.gov/14195'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://svs.gsfc.nasa.gov/14195'
      and rr.status = 'pending'
  );


-- grca-south-rim-summer-timelapse
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'grca-south-rim-summer-timelapse', 'short'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Grand Canyon South Rim summer time-lapse', 'تعلیمی مواد', 'Grand Canyon South Rim summer timelapse', 'Live-test candidate ITEM-017: Grand Canyon South Rim summer time-lapse by U.S. National Park Service. Licence candidate US-gov-work. NPS states public-domain b-roll; no NPS endorsement implication; no arrowhead trademark use.', 'تعلیمی مواد', 'Grand Canyon South Rim summer timelapse',
    (select id from public.categories where slug='learn'), 'en', 45, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'other'::public.source_provider, 'item-017', 'https://www.nps.gov/grca/learn/photosmultimedia/b-roll_hd01.htm', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'grca-south-rim-summer-timelapse', 'source_url', 'https://www.nps.gov/grca/learn/photosmultimedia/b-roll_hd01.htm', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://www.nps.gov/grca/learn/photosmultimedia/b-roll_hd01.htm', 'U.S. National Park Service', 'US-gov-work', 'U.S. National Park Service — US-gov-work — https://www.nps.gov/grca/learn/photosmultimedia/b-roll_hd01.htm', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://www.nps.gov/grca/learn/photosmultimedia/b-roll_hd01.htm', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'grca-south-rim-summer-timelapse'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://www.nps.gov/grca/learn/photosmultimedia/b-roll_hd01.htm'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://www.nps.gov/grca/learn/photosmultimedia/b-roll_hd01.htm'
      and rr.status = 'pending'
  );


-- grca-animals-broll
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'grca-animals-broll', 'short'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Animals at Grand Canyon b-roll', 'تعلیمی مواد', 'Animals at Grand Canyon broll', 'Live-test candidate ITEM-018: Animals at Grand Canyon b-roll by U.S. National Park Service. Licence candidate US-gov-work. NPS public-domain animal b-roll page; pick one clip (e.g. bison) as the single asset.', 'تعلیمی مواد', 'Animals at Grand Canyon broll',
    (select id from public.categories where slug='learn'), 'en', 96, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'other'::public.source_provider, 'item-018', 'https://www.nps.gov/grca/learn/photosmultimedia/b-roll_hd20.htm', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'grca-animals-broll', 'source_url', 'https://www.nps.gov/grca/learn/photosmultimedia/b-roll_hd20.htm', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://www.nps.gov/grca/learn/photosmultimedia/b-roll_hd20.htm', 'U.S. National Park Service', 'US-gov-work', 'U.S. National Park Service — US-gov-work — https://www.nps.gov/grca/learn/photosmultimedia/b-roll_hd20.htm', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://www.nps.gov/grca/learn/photosmultimedia/b-roll_hd20.htm', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'grca-animals-broll'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://www.nps.gov/grca/learn/photosmultimedia/b-roll_hd20.htm'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://www.nps.gov/grca/learn/photosmultimedia/b-roll_hd20.htm'
      and rr.status = 'pending'
  );


-- eso-cast-265-light
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'eso-cast-265-light', 'short'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'ESOcast 265 Light — Neptune dark spot', 'تعلیمی مواد', 'ESOcast 265 Light  Neptune dark spot', 'Live-test candidate ITEM-019: ESOcast 265 Light — Neptune dark spot by European Southern Observatory. Licence candidate CC-BY-4.0. Exact ESO video; Commons File:ESOcast_265_Light.webm; attribution required; check third-party credits on page.', 'تعلیمی مواد', 'ESOcast 265 Light  Neptune dark spot',
    (select id from public.categories where slug='learn'), 'en', 87, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'other'::public.source_provider, 'item-019', 'https://www.eso.org/public/videos/eso2314a/', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'eso-cast-265-light', 'source_url', 'https://www.eso.org/public/videos/eso2314a/', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://www.eso.org/public/videos/eso2314a/', 'European Southern Observatory', 'CC-BY-4.0', 'European Southern Observatory — CC-BY-4.0 — https://www.eso.org/public/videos/eso2314a/', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://www.eso.org/public/videos/eso2314a/', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'eso-cast-265-light'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://www.eso.org/public/videos/eso2314a/'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://www.eso.org/public/videos/eso2314a/'
      and rr.status = 'pending'
  );


-- eso-vista-cosmos-zoom
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'eso-vista-cosmos-zoom', 'short'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Zooming into VISTA COSMOS field', 'تعلیمی مواد', 'Zooming into VISTA COSMOS field', 'Live-test candidate ITEM-020: Zooming into VISTA COSMOS field by European Southern Observatory. Licence candidate CC-BY-4.0-except-exclusions. Page credits music John Dyson — mute/replace music unless Music Archive CC BY path confirmed.', 'تعلیمی مواد', 'Zooming into VISTA COSMOS field',
    (select id from public.categories where slug='learn'), 'en', 56, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'other'::public.source_provider, 'item-020', 'https://www.eso.org/public/videos/eso1213a/', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'eso-vista-cosmos-zoom', 'source_url', 'https://www.eso.org/public/videos/eso1213a/', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://www.eso.org/public/videos/eso1213a/', 'European Southern Observatory', 'CC-BY-4.0-except-exclusions', 'European Southern Observatory — CC-BY-4.0-except-exclusions — https://www.eso.org/public/videos/eso1213a/', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://www.eso.org/public/videos/eso1213a/', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'eso-vista-cosmos-zoom'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://www.eso.org/public/videos/eso1213a/'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://www.eso.org/public/videos/eso1213a/'
      and rr.status = 'pending'
  );


-- proxima-centauri-flythrough-cc-by
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'proxima-centauri-flythrough-cc-by', 'short'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Fly-through of the Proxima Centauri system', 'تعلیمی مواد', 'Flythrough of the Proxima Centauri system', 'Live-test candidate ITEM-021: Fly-through of the Proxima Centauri system by PHL @ UPR Arecibo / ESO. Licence candidate CC-BY-4.0. CC BY 4.0 via ESO; attribution; music credit Lyford Rome — confirm reuse or mute.', 'تعلیمی مواد', 'Flythrough of the Proxima Centauri system',
    (select id from public.categories where slug='learn'), 'en', 126, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'wikimedia'::public.source_provider, 'item-021', 'https://commons.wikimedia.org/wiki/File:A_fly-through_of_the_Proxima_Centauri_system_(video).webm', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'proxima-centauri-flythrough-cc-by', 'source_url', 'https://commons.wikimedia.org/wiki/File:A_fly-through_of_the_Proxima_Centauri_system_(video).webm', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://commons.wikimedia.org/wiki/File:A_fly-through_of_the_Proxima_Centauri_system_(video).webm', 'PHL @ UPR Arecibo / ESO', 'CC-BY-4.0', 'PHL @ UPR Arecibo / ESO — CC-BY-4.0 — https://commons.wikimedia.org/wiki/File:A_fly-through_of_the_Proxima_Centauri_system_(video).webm', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://commons.wikimedia.org/wiki/File:A_fly-through_of_the_Proxima_Centauri_system_(video).webm', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'proxima-centauri-flythrough-cc-by'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:A_fly-through_of_the_Proxima_Centauri_system_(video).webm'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:A_fly-through_of_the_Proxima_Centauri_system_(video).webm'
      and rr.status = 'pending'
  );


-- chauntra-village-spring
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'chauntra-village-spring', 'short'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Chauntra village spring', 'تعلیمی مواد', 'Chauntra village spring', 'Live-test candidate ITEM-022: Chauntra village spring by Dr.soft. Licence candidate CC-BY-SA-3.0. CC BY-SA 3.0; ShareAlike obligations apply to adapted redistributions; Pakistan geography/learning short.', 'تعلیمی مواد', 'Chauntra village spring',
    (select id from public.categories where slug='learn'), 'en', 60, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'wikimedia'::public.source_provider, 'item-022', 'https://commons.wikimedia.org/wiki/File:Chauntra_Village_Spring.webm', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'chauntra-village-spring', 'source_url', 'https://commons.wikimedia.org/wiki/File:Chauntra_Village_Spring.webm', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://commons.wikimedia.org/wiki/File:Chauntra_Village_Spring.webm', 'Dr.soft', 'CC-BY-SA-3.0', 'Dr.soft — CC-BY-SA-3.0 — https://commons.wikimedia.org/wiki/File:Chauntra_Village_Spring.webm', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://commons.wikimedia.org/wiki/File:Chauntra_Village_Spring.webm', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'chauntra-village-spring'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Chauntra_Village_Spring.webm'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Chauntra_Village_Spring.webm'
      and rr.status = 'pending'
  );


-- khyber-karma-dvids
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'khyber-karma-dvids', 'short'::public.content_type, 'external_link'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Khyber Karma: Joint Cooperation In The Pass', 'پاکستان مواد', 'Khyber Karma Joint Cooperation In The Pass', 'Live-test candidate ITEM-023: Khyber Karma: Joint Cooperation In The Pass by Cpl. Joshua DeFour / DVIDS. Licence candidate US-gov-work-with-dvids-limits. USG employee work; must display non-endorsement disclaimer; confirm no non-DoW IP; Pakistan-shelf context; commercial-use flags require Rights Lead sign-off.', 'پاکستان مواد', 'Khyber Karma Joint Cooperation In The Pass',
    (select id from public.categories where slug='pakistan'), 'en', 472, 'general', 'current_affairs_review'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'other'::public.source_provider, 'item-023', 'https://www.dvidshub.net/video/297565/khyber-karma-joint-cooperation-pass', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'khyber-karma-dvids', 'source_url', 'https://www.dvidshub.net/video/297565/khyber-karma-joint-cooperation-pass', 'hosting_mode', 'external_link', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://www.dvidshub.net/video/297565/khyber-karma-joint-cooperation-pass', 'Cpl. Joshua DeFour / DVIDS', 'US-gov-work-with-dvids-limits', 'Cpl. Joshua DeFour / DVIDS — US-gov-work-with-dvids-limits — https://www.dvidshub.net/video/297565/khyber-karma-joint-cooperation-pass', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://www.dvidshub.net/video/297565/khyber-karma-joint-cooperation-pass', null, 'content-lead@jalwa.local',
  false, false, false, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'khyber-karma-dvids'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://www.dvidshub.net/video/297565/khyber-karma-joint-cooperation-pass'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://www.dvidshub.net/video/297565/khyber-karma-joint-cooperation-pass'
      and rr.status = 'pending'
  );


-- op-mustang-dvids
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'op-mustang-dvids', 'short'::public.content_type, 'external_link'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'OP Mustang Multimedia', 'پاکستان مواد', 'OP Mustang Multimedia', 'Live-test candidate ITEM-024: OP Mustang Multimedia by Staff Sgt. Mark Burrell / DVIDS. Licence candidate US-gov-work-with-dvids-limits. Border OP documentary; non-endorsement; sensitivity review for conflict imagery before publish.', 'پاکستان مواد', 'OP Mustang Multimedia',
    (select id from public.categories where slug='pakistan'), 'en', 220, 'general', 'current_affairs_review'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'other'::public.source_provider, 'item-024', 'https://www.dvidshub.net/video/107630/op-mustang-multimedia', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'op-mustang-dvids', 'source_url', 'https://www.dvidshub.net/video/107630/op-mustang-multimedia', 'hosting_mode', 'external_link', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://www.dvidshub.net/video/107630/op-mustang-multimedia', 'Staff Sgt. Mark Burrell / DVIDS', 'US-gov-work-with-dvids-limits', 'Staff Sgt. Mark Burrell / DVIDS — US-gov-work-with-dvids-limits — https://www.dvidshub.net/video/107630/op-mustang-multimedia', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://www.dvidshub.net/video/107630/op-mustang-multimedia', null, 'content-lead@jalwa.local',
  false, false, false, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'op-mustang-dvids'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://www.dvidshub.net/video/107630/op-mustang-multimedia'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://www.dvidshub.net/video/107630/op-mustang-multimedia'
      and rr.status = 'pending'
  );


-- rawhide-ii-border-hub-dvids
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'rawhide-ii-border-hub-dvids', 'short'::public.content_type, 'external_link'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    '3rd LAR Marines Attack Key Insurgent Border Hub', 'پاکستان مواد', '3rd LAR Marines Attack Key Insurgent Border Hub', 'Live-test candidate ITEM-025: 3rd LAR Marines Attack Key Insurgent Border Hub by Staff Sgt. Jeremy Ross / DVIDS. Licence candidate US-gov-work-with-dvids-limits. Combat package; current-affairs/sensitivity review mandatory; non-endorsement disclaimer.', 'پاکستان مواد', '3rd LAR Marines Attack Key Insurgent Border Hub',
    (select id from public.categories where slug='pakistan'), 'en', 148, 'general', 'current_affairs_review'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'other'::public.source_provider, 'item-025', 'https://www.dvidshub.net/video/110717/3rd-lar-marines-attack-key-insurgent-border-hub', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'rawhide-ii-border-hub-dvids', 'source_url', 'https://www.dvidshub.net/video/110717/3rd-lar-marines-attack-key-insurgent-border-hub', 'hosting_mode', 'external_link', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://www.dvidshub.net/video/110717/3rd-lar-marines-attack-key-insurgent-border-hub', 'Staff Sgt. Jeremy Ross / DVIDS', 'US-gov-work-with-dvids-limits', 'Staff Sgt. Jeremy Ross / DVIDS — US-gov-work-with-dvids-limits — https://www.dvidshub.net/video/110717/3rd-lar-marines-attack-key-insurgent-border-hub', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://www.dvidshub.net/video/110717/3rd-lar-marines-attack-key-insurgent-border-hub', null, 'content-lead@jalwa.local',
  false, false, false, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'rawhide-ii-border-hub-dvids'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://www.dvidshub.net/video/110717/3rd-lar-marines-attack-key-insurgent-border-hub'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://www.dvidshub.net/video/110717/3rd-lar-marines-attack-key-insurgent-border-hub'
      and rr.status = 'pending'
  );


-- invitation-to-pakistan-nara
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'invitation-to-pakistan-nara', 'short'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Invitation to Pakistan (1962)', 'پاکستان مواد', 'Invitation to Pakistan 1962', 'Live-test candidate ITEM-026: Invitation to Pakistan (1962) by U.S. National Archives. Licence candidate US-gov-work. NARA ARC 1553867; treat as US gov work candidate; verify Commons licence template and any third-party music.', 'پاکستان مواد', 'Invitation to Pakistan 1962',
    (select id from public.categories where slug='pakistan'), 'en', 934, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'wikimedia'::public.source_provider, 'item-026', 'https://commons.wikimedia.org/wiki/File:Invitation_to_Pakistan.ogv', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'invitation-to-pakistan-nara', 'source_url', 'https://commons.wikimedia.org/wiki/File:Invitation_to_Pakistan.ogv', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://commons.wikimedia.org/wiki/File:Invitation_to_Pakistan.ogv', 'U.S. National Archives', 'US-gov-work', 'U.S. National Archives — US-gov-work — https://commons.wikimedia.org/wiki/File:Invitation_to_Pakistan.ogv', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://commons.wikimedia.org/wiki/File:Invitation_to_Pakistan.ogv', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'invitation-to-pakistan-nara'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Invitation_to_Pakistan.ogv'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Invitation_to_Pakistan.ogv'
      and rr.status = 'pending'
  );


-- vanellus-vanellus-cc0
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'vanellus-vanellus-cc0', 'short'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Northern Lapwing sounds and flight', 'پاکستان مواد', 'Northern Lapwing sounds and flight', 'Live-test candidate ITEM-027: Northern Lapwing sounds and flight by Hugo.arg. Licence candidate CC0-1.0. CC0 nature short placed on Pakistan shelf as general wildlife learning filler pending local wildlife CC0 finds.', 'پاکستان مواد', 'Northern Lapwing sounds and flight',
    (select id from public.categories where slug='pakistan'), 'en', 29, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'wikimedia'::public.source_provider, 'item-027', 'https://commons.wikimedia.org/wiki/File:Vanellus_vanellus.ogv', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'vanellus-vanellus-cc0', 'source_url', 'https://commons.wikimedia.org/wiki/File:Vanellus_vanellus.ogv', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://commons.wikimedia.org/wiki/File:Vanellus_vanellus.ogv', 'Hugo.arg', 'CC0-1.0', 'Hugo.arg — CC0-1.0 — https://commons.wikimedia.org/wiki/File:Vanellus_vanellus.ogv', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://commons.wikimedia.org/wiki/File:Vanellus_vanellus.ogv', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'vanellus-vanellus-cc0'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Vanellus_vanellus.ogv'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Vanellus_vanellus.ogv'
      and rr.status = 'pending'
  );


-- eastern-hindu-kush-lowari
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'eastern-hindu-kush-lowari', 'short'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Eastern Hindu Kush from Lowari Pass', 'پاکستان مواد', 'Eastern Hindu Kush from Lowari Pass', 'Live-test candidate ITEM-028: Eastern Hindu Kush from Lowari Pass by Fowler&fowler. Licence candidate CC-BY-SA-4.0. CC BY-SA 4.0 own-work; Pakistan geography short; ShareAlike applies.', 'پاکستان مواد', 'Eastern Hindu Kush from Lowari Pass',
    (select id from public.categories where slug='pakistan'), 'en', 14, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'wikimedia'::public.source_provider, 'item-028', 'https://commons.wikimedia.org/wiki/File:Eastern_Hindu_Kush_range_Pakistan-Afghanistan.webm', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'eastern-hindu-kush-lowari', 'source_url', 'https://commons.wikimedia.org/wiki/File:Eastern_Hindu_Kush_range_Pakistan-Afghanistan.webm', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://commons.wikimedia.org/wiki/File:Eastern_Hindu_Kush_range_Pakistan-Afghanistan.webm', 'Fowler&fowler', 'CC-BY-SA-4.0', 'Fowler&fowler — CC-BY-SA-4.0 — https://commons.wikimedia.org/wiki/File:Eastern_Hindu_Kush_range_Pakistan-Afghanistan.webm', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://commons.wikimedia.org/wiki/File:Eastern_Hindu_Kush_range_Pakistan-Afghanistan.webm', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'eastern-hindu-kush-lowari'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Eastern_Hindu_Kush_range_Pakistan-Afghanistan.webm'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Eastern_Hindu_Kush_range_Pakistan-Afghanistan.webm'
      and rr.status = 'pending'
  );


-- hunza-valley-wle-2018
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'hunza-valley-wle-2018', 'short'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Hunza Valley autumn (Wiki Loves Earth 2018)', 'پاکستان مواد', 'Hunza Valley autumn Wiki Loves Earth 2018', 'Live-test candidate ITEM-029: Hunza Valley autumn (Wiki Loves Earth 2018) by Nabin K. Sapkota / Nasr Rahman. Licence candidate CC-BY-SA-4.0. CC BY-SA 4.0; attribute both video producer and photo author as File page requires.', 'پاکستان مواد', 'Hunza Valley autumn Wiki Loves Earth 2018',
    (select id from public.categories where slug='pakistan'), 'en', 14, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'wikimedia'::public.source_provider, 'item-029', 'https://commons.wikimedia.org/wiki/File:Hunza_Valley_-_5th_position_-_Winners_of_Wiki_Loves_Earth_2018.webm', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'hunza-valley-wle-2018', 'source_url', 'https://commons.wikimedia.org/wiki/File:Hunza_Valley_-_5th_position_-_Winners_of_Wiki_Loves_Earth_2018.webm', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://commons.wikimedia.org/wiki/File:Hunza_Valley_-_5th_position_-_Winners_of_Wiki_Loves_Earth_2018.webm', 'Nabin K. Sapkota / Nasr Rahman', 'CC-BY-SA-4.0', 'Nabin K. Sapkota / Nasr Rahman — CC-BY-SA-4.0 — https://commons.wikimedia.org/wiki/File:Hunza_Valley_-_5th_position_-_Winners_of_Wiki_Loves_Earth_2018.webm', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://commons.wikimedia.org/wiki/File:Hunza_Valley_-_5th_position_-_Winners_of_Wiki_Loves_Earth_2018.webm', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'hunza-valley-wle-2018'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Hunza_Valley_-_5th_position_-_Winners_of_Wiki_Loves_Earth_2018.webm'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Hunza_Valley_-_5th_position_-_Winners_of_Wiki_Loves_Earth_2018.webm'
      and rr.status = 'pending'
  );


-- indus-kotri-barrage
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'indus-kotri-barrage', 'short'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Indus River at Kotri Barrage, Jamshoro', 'پاکستان مواد', 'Indus River at Kotri Barrage Jamshoro', 'Live-test candidate ITEM-030: Indus River at Kotri Barrage, Jamshoro by JogiAsad. Licence candidate CC-BY-SA-4.0. CC BY-SA 4.0 Sindh geography short; large source file — encode ladder after rights OK.', 'پاکستان مواد', 'Indus River at Kotri Barrage Jamshoro',
    (select id from public.categories where slug='pakistan'), 'en', 99, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'wikimedia'::public.source_provider, 'item-030', 'https://commons.wikimedia.org/wiki/File:River_Indus_at_Kotri_Barrage_Jamshoro.webm', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'indus-kotri-barrage', 'source_url', 'https://commons.wikimedia.org/wiki/File:River_Indus_at_Kotri_Barrage_Jamshoro.webm', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://commons.wikimedia.org/wiki/File:River_Indus_at_Kotri_Barrage_Jamshoro.webm', 'JogiAsad', 'CC-BY-SA-4.0', 'JogiAsad — CC-BY-SA-4.0 — https://commons.wikimedia.org/wiki/File:River_Indus_at_Kotri_Barrage_Jamshoro.webm', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://commons.wikimedia.org/wiki/File:River_Indus_at_Kotri_Barrage_Jamshoro.webm', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'indus-kotri-barrage'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:River_Indus_at_Kotri_Barrage_Jamshoro.webm'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:River_Indus_at_Kotri_Barrage_Jamshoro.webm'
      and rr.status = 'pending'
  );


-- big-buck-bunny
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'big-buck-bunny', 'video'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Big Buck Bunny', 'تفریحی مواد', 'Big Buck Bunny', 'Live-test candidate ITEM-031: Big Buck Bunny by Blender Foundation / Peach Open Movie Project. Licence candidate CC-BY-3.0. Film-level CC BY; retain full credits; one distinct film only.', 'تفریحی مواد', 'Big Buck Bunny',
    (select id from public.categories where slug='entertainment'), 'en', 600, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'blender'::public.source_provider, 'item-031', 'https://peach.blender.org/download/', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'big-buck-bunny', 'source_url', 'https://peach.blender.org/download/', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://peach.blender.org/download/', 'Blender Foundation / Peach Open Movie Project', 'CC-BY-3.0', 'Blender Foundation / Peach Open Movie Project — CC-BY-3.0 — https://peach.blender.org/download/', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://peach.blender.org/download/', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'big-buck-bunny'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://peach.blender.org/download/'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://peach.blender.org/download/'
      and rr.status = 'pending'
  );


-- sintel
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'sintel', 'video'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Sintel', 'تفریحی مواد', 'Sintel', 'Live-test candidate ITEM-032: Sintel by Blender Foundation / Durian Open Movie Project. Licence candidate CC-BY-3.0. Film-level CC BY; review original credit terms.', 'تفریحی مواد', 'Sintel',
    (select id from public.categories where slug='entertainment'), 'en', 888, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'blender'::public.source_provider, 'item-032', 'https://durian.blender.org/download/', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'sintel', 'source_url', 'https://durian.blender.org/download/', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://durian.blender.org/download/', 'Blender Foundation / Durian Open Movie Project', 'CC-BY-3.0', 'Blender Foundation / Durian Open Movie Project — CC-BY-3.0 — https://durian.blender.org/download/', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://durian.blender.org/download/', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'sintel'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://durian.blender.org/download/'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://durian.blender.org/download/'
      and rr.status = 'pending'
  );


-- elephants-dream
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'elephants-dream', 'video'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Elephants Dream', 'تفریحی مواد', 'Elephants Dream', 'Live-test candidate ITEM-033: Elephants Dream by Blender Foundation / Orange Open Movie Project. Licence candidate CC-BY-2.5. CC BY 2.5; full credit required.', 'تفریحی مواد', 'Elephants Dream',
    (select id from public.categories where slug='entertainment'), 'en', 654, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'blender'::public.source_provider, 'item-033', 'https://orange.blender.org/download/', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'elephants-dream', 'source_url', 'https://orange.blender.org/download/', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://orange.blender.org/download/', 'Blender Foundation / Orange Open Movie Project', 'CC-BY-2.5', 'Blender Foundation / Orange Open Movie Project — CC-BY-2.5 — https://orange.blender.org/download/', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://orange.blender.org/download/', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'elephants-dream'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://orange.blender.org/download/'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://orange.blender.org/download/'
      and rr.status = 'pending'
  );


-- sprite-fright
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'sprite-fright', 'video'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Sprite Fright', 'تفریحی مواد', 'Sprite Fright', 'Live-test candidate ITEM-034: Sprite Fright by Blender Studio. Licence candidate CC-BY-4.0. Verify current Blender Studio licence notice on film page.', 'تفریحی مواد', 'Sprite Fright',
    (select id from public.categories where slug='entertainment'), 'en', 210, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'blender'::public.source_provider, 'item-034', 'https://studio.blender.org/films/sprite-fright/', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'sprite-fright', 'source_url', 'https://studio.blender.org/films/sprite-fright/', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://studio.blender.org/films/sprite-fright/', 'Blender Studio', 'CC-BY-4.0', 'Blender Studio — CC-BY-4.0 — https://studio.blender.org/films/sprite-fright/', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://studio.blender.org/films/sprite-fright/', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'sprite-fright'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://studio.blender.org/films/sprite-fright/'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://studio.blender.org/films/sprite-fright/'
      and rr.status = 'pending'
  );


-- artemis-science-lunar-flyby-svs
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'artemis-science-lunar-flyby-svs', 'video'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Artemis Science: Visualizing NASA’s Next Lunar Flyby', 'تعلیمی مواد', 'Artemis Science Visualizing NASAs Next Lunar Flyby', 'Live-test candidate ITEM-035: Artemis Science: Visualizing NASA’s Next Lunar Flyby by NASA/GSFC Scientific Visualization Studio. Licence candidate NASA-media-guidelines. Contains Universal Production Music — use mute/music-free cut or confirm clearance before self-host.', 'تعلیمی مواد', 'Artemis Science Visualizing NASAs Next Lunar Flyby',
    (select id from public.categories where slug='learn'), 'en', 300, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'nasa'::public.source_provider, 'item-035', 'https://svs.gsfc.nasa.gov/14938', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'artemis-science-lunar-flyby-svs', 'source_url', 'https://svs.gsfc.nasa.gov/14938', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://svs.gsfc.nasa.gov/14938', 'NASA/GSFC Scientific Visualization Studio', 'NASA-media-guidelines', 'NASA/GSFC Scientific Visualization Studio — NASA-media-guidelines — https://svs.gsfc.nasa.gov/14938', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://svs.gsfc.nasa.gov/14938', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'artemis-science-lunar-flyby-svs'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://svs.gsfc.nasa.gov/14938'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://svs.gsfc.nasa.gov/14938'
      and rr.status = 'pending'
  );


-- proxima-centauri-eso-medium
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'proxima-centauri-eso-medium', 'video'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Proxima Centauri system fly-through (ESO source)', 'تعلیمی مواد', 'Proxima Centauri system flythrough ESO source', 'Live-test candidate ITEM-036: Proxima Centauri system fly-through (ESO source) by ESO / PHL @ UPR Arecibo. Licence candidate CC-BY-4.0. Official ESO page for the Proxima fly-through; distinct source URL from Commons mirror ITEM-021 — Rights Lead must pick one host path only.', 'تعلیمی مواد', 'Proxima Centauri system flythrough ESO source',
    (select id from public.categories where slug='learn'), 'en', 126, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'other'::public.source_provider, 'item-036', 'https://www.eso.org/public/videos/eso1629f/', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'proxima-centauri-eso-medium', 'source_url', 'https://www.eso.org/public/videos/eso1629f/', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://www.eso.org/public/videos/eso1629f/', 'ESO / PHL @ UPR Arecibo', 'CC-BY-4.0', 'ESO / PHL @ UPR Arecibo — CC-BY-4.0 — https://www.eso.org/public/videos/eso1629f/', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://www.eso.org/public/videos/eso1629f/', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'proxima-centauri-eso-medium'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://www.eso.org/public/videos/eso1629f/'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://www.eso.org/public/videos/eso1629f/'
      and rr.status = 'pending'
  );


-- grca-south-rim-winter-scenic
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'grca-south-rim-winter-scenic', 'video'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Grand Canyon South Rim winter scenic b-roll', 'تعلیمی مواد', 'Grand Canyon South Rim winter scenic broll', 'Live-test candidate ITEM-037: Grand Canyon South Rim winter scenic b-roll by U.S. National Park Service. Licence candidate US-gov-work. NPS public-domain scenic page; select one multi-clip editorial assembly as a single medium item.', 'تعلیمی مواد', 'Grand Canyon South Rim winter scenic broll',
    (select id from public.categories where slug='learn'), 'en', 180, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'other'::public.source_provider, 'item-037', 'https://www.nps.gov/grca/learn/photosmultimedia/b-roll_hd16.htm', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'grca-south-rim-winter-scenic', 'source_url', 'https://www.nps.gov/grca/learn/photosmultimedia/b-roll_hd16.htm', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://www.nps.gov/grca/learn/photosmultimedia/b-roll_hd16.htm', 'U.S. National Park Service', 'US-gov-work', 'U.S. National Park Service — US-gov-work — https://www.nps.gov/grca/learn/photosmultimedia/b-roll_hd16.htm', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://www.nps.gov/grca/learn/photosmultimedia/b-roll_hd16.htm', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'grca-south-rim-winter-scenic'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://www.nps.gov/grca/learn/photosmultimedia/b-roll_hd16.htm'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://www.nps.gov/grca/learn/photosmultimedia/b-roll_hd16.htm'
      and rr.status = 'pending'
  );


-- wikipedia-science-comms-cc-by
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'wikipedia-science-comms-cc-by', 'video'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Harnessing Wikipedia for science communication', 'تعلیمی مواد', 'Harnessing Wikipedia for science communication', 'Live-test candidate ITEM-038: Harnessing Wikipedia for science communication by Wikimedia Australia / Dr. Katelyn Mroczek. Licence candidate CC-BY-4.0. CC BY 4.0 educational talk; attribution required; if ITEM-022 excerpt used, do not also publish this full cut.', 'تعلیمی مواد', 'Harnessing Wikipedia for science communication',
    (select id from public.categories where slug='learn'), 'en', 1480, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'wikimedia'::public.source_provider, 'item-038', 'https://commons.wikimedia.org/wiki/File:Harnessing_Wikipedia_for_Science_Communication_and_Collaboration.webm', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'wikipedia-science-comms-cc-by', 'source_url', 'https://commons.wikimedia.org/wiki/File:Harnessing_Wikipedia_for_Science_Communication_and_Collaboration.webm', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://commons.wikimedia.org/wiki/File:Harnessing_Wikipedia_for_Science_Communication_and_Collaboration.webm', 'Wikimedia Australia / Dr. Katelyn Mroczek', 'CC-BY-4.0', 'Wikimedia Australia / Dr. Katelyn Mroczek — CC-BY-4.0 — https://commons.wikimedia.org/wiki/File:Harnessing_Wikipedia_for_Science_Communication_and_Collaboration.webm', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://commons.wikimedia.org/wiki/File:Harnessing_Wikipedia_for_Science_Communication_and_Collaboration.webm', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'wikipedia-science-comms-cc-by'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Harnessing_Wikipedia_for_Science_Communication_and_Collaboration.webm'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Harnessing_Wikipedia_for_Science_Communication_and_Collaboration.webm'
      and rr.status = 'pending'
  );


-- promise-of-pakistan-geography
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'promise-of-pakistan-geography', 'video'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Promise of Pakistan Geography (1950)', 'تعلیمی مواد', 'Promise of Pakistan Geography 1950', 'Live-test candidate ITEM-039: Promise of Pakistan Geography (1950) by U.S. National Archives / CIA. Licence candidate US-gov-work. NARA ARC 641839 US gov work on Commons; historical framing requires editorial note; Archive mirror https://archive.org/details/gov.archives.arc.641839.', 'تعلیمی مواد', 'Promise of Pakistan Geography 1950',
    (select id from public.categories where slug='learn'), 'en', 1069, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'other'::public.source_provider, 'item-039', 'https://commons.wikimedia.org/wiki/File:Pakistan.ogv', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'promise-of-pakistan-geography', 'source_url', 'https://commons.wikimedia.org/wiki/File:Pakistan.ogv', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://commons.wikimedia.org/wiki/File:Pakistan.ogv', 'U.S. National Archives / CIA', 'US-gov-work', 'U.S. National Archives / CIA — US-gov-work — https://commons.wikimedia.org/wiki/File:Pakistan.ogv', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://commons.wikimedia.org/wiki/File:Pakistan.ogv', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'promise-of-pakistan-geography'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Pakistan.ogv'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Pakistan.ogv'
      and rr.status = 'pending'
  );


-- hst-sm4-rendezvous-nasa
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'hst-sm4-rendezvous-nasa', 'video'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'HST SM4 rendezvous and capturing', 'تعلیمی مواد', 'HST SM4 rendezvous and capturing', 'Live-test candidate ITEM-040: HST SM4 rendezvous and capturing by NASA/GSFC. Licence candidate NASA-media-guidelines. NASA Image Library video; nasa_id GSFC_20080822_HST_m10329_Capture_005.', 'تعلیمی مواد', 'HST SM4 rendezvous and capturing',
    (select id from public.categories where slug='learn'), 'en', 180, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'other'::public.source_provider, 'item-040', 'https://images.nasa.gov/details/GSFC_20080822_HST_m10329_Capture_005', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'hst-sm4-rendezvous-nasa', 'source_url', 'https://images.nasa.gov/details/GSFC_20080822_HST_m10329_Capture_005', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://images.nasa.gov/details/GSFC_20080822_HST_m10329_Capture_005', 'NASA/GSFC', 'NASA-media-guidelines', 'NASA/GSFC — NASA-media-guidelines — https://images.nasa.gov/details/GSFC_20080822_HST_m10329_Capture_005', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://images.nasa.gov/details/GSFC_20080822_HST_m10329_Capture_005', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'hst-sm4-rendezvous-nasa'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://images.nasa.gov/details/GSFC_20080822_HST_m10329_Capture_005'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://images.nasa.gov/details/GSFC_20080822_HST_m10329_Capture_005'
      and rr.status = 'pending'
  );


-- tears-of-steel
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'tears-of-steel', 'video'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Tears of Steel', 'تفریحی مواد', 'Tears of Steel', 'Live-test candidate ITEM-041: Tears of Steel by Blender Foundation / Mango Open Movie Project. Licence candidate CC-BY-3.0. Distinct long film; HLS 360/480/720 after rights OK.', 'تفریحی مواد', 'Tears of Steel',
    (select id from public.categories where slug='entertainment'), 'en', 734, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'blender'::public.source_provider, 'item-041', 'https://mango.blender.org/download/', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'tears-of-steel', 'source_url', 'https://mango.blender.org/download/', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://mango.blender.org/download/', 'Blender Foundation / Mango Open Movie Project', 'CC-BY-3.0', 'Blender Foundation / Mango Open Movie Project — CC-BY-3.0 — https://mango.blender.org/download/', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://mango.blender.org/download/', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'tears-of-steel'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://mango.blender.org/download/'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://mango.blender.org/download/'
      and rr.status = 'pending'
  );


-- spring-blender
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'spring-blender', 'video'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Spring', 'تفریحی مواد', 'Spring', 'Live-test candidate ITEM-042: Spring by Blender Studio. Licence candidate CC-BY-4.0. Verify current licence on film page; distinct from shorts trims.', 'تفریحی مواد', 'Spring',
    (select id from public.categories where slug='entertainment'), 'en', 470, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'blender'::public.source_provider, 'item-042', 'https://studio.blender.org/films/spring/', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'spring-blender', 'source_url', 'https://studio.blender.org/films/spring/', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://studio.blender.org/films/spring/', 'Blender Studio', 'CC-BY-4.0', 'Blender Studio — CC-BY-4.0 — https://studio.blender.org/films/spring/', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://studio.blender.org/films/spring/', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'spring-blender'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://studio.blender.org/films/spring/'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://studio.blender.org/films/spring/'
      and rr.status = 'pending'
  );


-- cosmos-laundromat
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'cosmos-laundromat', 'video'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Cosmos Laundromat: First Cycle', 'تفریحی مواد', 'Cosmos Laundromat First Cycle', 'Live-test candidate ITEM-043: Cosmos Laundromat: First Cycle by Blender Foundation / Gooseberry Open Movie Project. Licence candidate CC-BY-3.0. Distinct Gooseberry film; CC BY 3.0 per gooseberry.blender.org/license/; retain credits.', 'تفریحی مواد', 'Cosmos Laundromat First Cycle',
    (select id from public.categories where slug='entertainment'), 'en', 720, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'blender'::public.source_provider, 'item-043', 'https://gooseberry.blender.org/download/', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'cosmos-laundromat', 'source_url', 'https://gooseberry.blender.org/download/', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://gooseberry.blender.org/download/', 'Blender Foundation / Gooseberry Open Movie Project', 'CC-BY-3.0', 'Blender Foundation / Gooseberry Open Movie Project — CC-BY-3.0 — https://gooseberry.blender.org/download/', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://gooseberry.blender.org/download/', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'cosmos-laundromat'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://gooseberry.blender.org/download/'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://gooseberry.blender.org/download/'
      and rr.status = 'pending'
  );


-- caminandes-llamigos
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'caminandes-llamigos', 'video'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Caminandes 3: Llamigos', 'تفریحی مواد', 'Caminandes 3 Llamigos', 'Live-test candidate ITEM-044: Caminandes 3: Llamigos by Blender Studio. Licence candidate CC-BY-4.0. Short-feature Blender film counted in long band per editorial class; verify CC BY on film page.', 'تفریحی مواد', 'Caminandes 3 Llamigos',
    (select id from public.categories where slug='entertainment'), 'en', 150, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'blender'::public.source_provider, 'item-044', 'https://studio.blender.org/films/caminandes-3/', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'caminandes-llamigos', 'source_url', 'https://studio.blender.org/films/caminandes-3/', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://studio.blender.org/films/caminandes-3/', 'Blender Studio', 'CC-BY-4.0', 'Blender Studio — CC-BY-4.0 — https://studio.blender.org/films/caminandes-3/', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://studio.blender.org/films/caminandes-3/', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'caminandes-llamigos'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://studio.blender.org/films/caminandes-3/'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://studio.blender.org/films/caminandes-3/'
      and rr.status = 'pending'
  );


-- apollo-11-eagle-has-landed
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'apollo-11-eagle-has-landed', 'video'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Eagle Has Landed: The Flight of Apollo 11', 'تعلیمی مواد', 'Eagle Has Landed The Flight of Apollo 11', 'Live-test candidate ITEM-045: Eagle Has Landed: The Flight of Apollo 11 by NASA. Licence candidate NASA-media-guidelines. HQ-194 NASA documentary (~28.5 min); distinct from SVS Earthrise ITEM-009; confirm no third-party music overlays on the selected master.', 'تعلیمی مواد', 'Eagle Has Landed The Flight of Apollo 11',
    (select id from public.categories where slug='learn'), 'en', 1710, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'nasa'::public.source_provider, 'item-045', 'https://images.nasa.gov/details/KSC-19690716-MH-NAS01-0001-The_Flight_of_Apollo_11_The_Eagle_Has_Landed_HS_from_Film_JSC-DVC_1928', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'apollo-11-eagle-has-landed', 'source_url', 'https://images.nasa.gov/details/KSC-19690716-MH-NAS01-0001-The_Flight_of_Apollo_11_The_Eagle_Has_Landed_HS_from_Film_JSC-DVC_1928', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://images.nasa.gov/details/KSC-19690716-MH-NAS01-0001-The_Flight_of_Apollo_11_The_Eagle_Has_Landed_HS_from_Film_JSC-DVC_1928', 'NASA', 'NASA-media-guidelines', 'NASA — NASA-media-guidelines — https://images.nasa.gov/details/KSC-19690716-MH-NAS01-0001-The_Flight_of_Apollo_11_The_Eagle_Has_Landed_HS_from_Film_JSC-DVC_1928', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://images.nasa.gov/details/KSC-19690716-MH-NAS01-0001-The_Flight_of_Apollo_11_The_Eagle_Has_Landed_HS_from_Film_JSC-DVC_1928', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'apollo-11-eagle-has-landed'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://images.nasa.gov/details/KSC-19690716-MH-NAS01-0001-The_Flight_of_Apollo_11_The_Eagle_Has_Landed_HS_from_Film_JSC-DVC_1928'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://images.nasa.gov/details/KSC-19690716-MH-NAS01-0001-The_Flight_of_Apollo_11_The_Eagle_Has_Landed_HS_from_Film_JSC-DVC_1928'
      and rr.status = 'pending'
  );


-- huamei-bird-calling-cc0
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'huamei-bird-calling-cc0', 'audio'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Upbeat huamei bird calling', 'تعلیمی مواد', 'Upbeat huamei bird calling', 'Live-test candidate ITEM-046: Upbeat huamei bird calling by Jidanni. Licence candidate CC0-1.0. CC0 nature audio File page.', 'تعلیمی مواد', 'Upbeat huamei bird calling',
    (select id from public.categories where slug='learn'), 'en', 191, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'wikimedia'::public.source_provider, 'item-046', 'https://commons.wikimedia.org/wiki/File:Upbeat_huamei_bird_calling.oga', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'huamei-bird-calling-cc0', 'source_url', 'https://commons.wikimedia.org/wiki/File:Upbeat_huamei_bird_calling.oga', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://commons.wikimedia.org/wiki/File:Upbeat_huamei_bird_calling.oga', 'Jidanni', 'CC0-1.0', 'Jidanni — CC0-1.0 — https://commons.wikimedia.org/wiki/File:Upbeat_huamei_bird_calling.oga', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://commons.wikimedia.org/wiki/File:Upbeat_huamei_bird_calling.oga', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'huamei-bird-calling-cc0'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Upbeat_huamei_bird_calling.oga'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Upbeat_huamei_bird_calling.oga'
      and rr.status = 'pending'
  );


-- house-sparrow-tschilp-cc0
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'house-sparrow-tschilp-cc0', 'audio'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'House sparrow tschilp call', 'تعلیمی مواد', 'House sparrow tschilp call', 'Live-test candidate ITEM-047: House sparrow tschilp call by Joseph Sardin. Licence candidate CC0-1.0. CC0 via BigSoundBank; short call recording.', 'تعلیمی مواد', 'House sparrow tschilp call',
    (select id from public.categories where slug='learn'), 'en', 6, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'wikimedia'::public.source_provider, 'item-047', 'https://commons.wikimedia.org/wiki/File:Joseph_Sardin_-_Passer_domesticus_tschilp_call.oga', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'house-sparrow-tschilp-cc0', 'source_url', 'https://commons.wikimedia.org/wiki/File:Joseph_Sardin_-_Passer_domesticus_tschilp_call.oga', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://commons.wikimedia.org/wiki/File:Joseph_Sardin_-_Passer_domesticus_tschilp_call.oga', 'Joseph Sardin', 'CC0-1.0', 'Joseph Sardin — CC0-1.0 — https://commons.wikimedia.org/wiki/File:Joseph_Sardin_-_Passer_domesticus_tschilp_call.oga', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://commons.wikimedia.org/wiki/File:Joseph_Sardin_-_Passer_domesticus_tschilp_call.oga', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'house-sparrow-tschilp-cc0'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Joseph_Sardin_-_Passer_domesticus_tschilp_call.oga'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Joseph_Sardin_-_Passer_domesticus_tschilp_call.oga'
      and rr.status = 'pending'
  );


-- abrasive-bird-debate-cc0
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'abrasive-bird-debate-cc0', 'audio'::public.content_type, 'self_host_open'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'Abrasive sounding bird debate', 'تعلیمی مواد', 'Abrasive sounding bird debate', 'Live-test candidate ITEM-048: Abrasive sounding bird debate by Jidanni. Licence candidate CC0-1.0. CC0 Pomatorhinus musicus recording.', 'تعلیمی مواد', 'Abrasive sounding bird debate',
    (select id from public.categories where slug='learn'), 'en', 63, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'wikimedia'::public.source_provider, 'item-048', 'https://commons.wikimedia.org/wiki/File:Abrasive_sounding_bird_debate.oga', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'abrasive-bird-debate-cc0', 'source_url', 'https://commons.wikimedia.org/wiki/File:Abrasive_sounding_bird_debate.oga', 'hosting_mode', 'self_host_open', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://commons.wikimedia.org/wiki/File:Abrasive_sounding_bird_debate.oga', 'Jidanni', 'CC0-1.0', 'Jidanni — CC0-1.0 — https://commons.wikimedia.org/wiki/File:Abrasive_sounding_bird_debate.oga', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://commons.wikimedia.org/wiki/File:Abrasive_sounding_bird_debate.oga', null, 'content-lead@jalwa.local',
  true, false, true, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'abrasive-bird-debate-cc0'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Abrasive_sounding_bird_debate.oga'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://commons.wikimedia.org/wiki/File:Abrasive_sounding_bird_debate.oga'
      and rr.status = 'pending'
  );


-- nasa-images-library-home-link
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'nasa-images-library-home-link', 'article'::public.content_type, 'external_link'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'NASA Image and Video Library (official)', 'تعلیمی مواد', 'NASA Image and Video Library official', 'Live-test candidate ITEM-049: NASA Image and Video Library (official) by NASA. Licence candidate official-link-only. Link-only institutional entry; never rehost/restream the library UI.', 'تعلیمی مواد', 'NASA Image and Video Library official',
    (select id from public.categories where slug='learn'), 'en', null, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'nasa'::public.source_provider, 'item-049', 'https://images.nasa.gov/', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'nasa-images-library-home-link', 'source_url', 'https://images.nasa.gov/', 'hosting_mode', 'external_link', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://images.nasa.gov/', 'NASA', 'official-link-only', 'NASA — official-link-only — https://images.nasa.gov/', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://images.nasa.gov/', null, 'content-lead@jalwa.local',
  false, false, false, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'nasa-images-library-home-link'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://images.nasa.gov/'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://images.nasa.gov/'
      and rr.status = 'pending'
  );


-- eso-public-videos-link
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    'eso-public-videos-link', 'article'::public.content_type, 'external_link'::public.hosting_mode, 'public'::public.access_level, 'draft'::public.content_status,
    'ESO public videos (official index)', 'تعلیمی مواد', 'ESO public videos official index', 'Live-test candidate ITEM-050: ESO public videos (official index) by European Southern Observatory. Licence candidate official-link-only. Link-only; individual ESO films are separate self-host candidates (ITEM-010/019/020).', 'تعلیمی مواد', 'ESO public videos official index',
    (select id from public.categories where slug='learn'), 'en', null, 'general', 'standard'
  )
  on conflict (slug) do update set
    content_type=excluded.content_type,
    hosting_mode=excluded.hosting_mode,
    access_level=excluded.access_level,
    title_en=excluded.title_en,
    title_ur=excluded.title_ur,
    title_roman_ur=excluded.title_roman_ur,
    description_en=excluded.description_en,
    description_ur=excluded.description_ur,
    description_roman_ur=excluded.description_roman_ur,
    primary_category_id=excluded.primary_category_id,
    language=excluded.language,
    duration_seconds=excluded.duration_seconds,
    audience=excluded.audience,
    sensitivity=excluded.sensitivity,
    updated_at=now()
  returning id
), src as (
  insert into public.playback_sources (content_id, provider, provider_content_id, external_url, is_primary, status)
  select id, 'other'::public.source_provider, 'item-050', 'https://www.eso.org/public/videos/', true, 'active'
  from upserted
  on conflict (provider, provider_content_id) do update set
    content_id=excluded.content_id,
    external_url=excluded.external_url,
    is_primary=true,
    status='active'
  returning content_id
)
insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
select null, 'catalogue_draft_imported', 'content_item', id,
  jsonb_build_object('slug', 'eso-public-videos-link', 'source_url', 'https://www.eso.org/public/videos/', 'hosting_mode', 'external_link', 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, 'https://www.eso.org/public/videos/', 'European Southern Observatory', 'official-link-only', 'European Southern Observatory — official-link-only — https://www.eso.org/public/videos/', 'Pakistan staging live-test draft; Rights Lead must approve before publish.',
  'https://www.eso.org/public/videos/', null, 'content-lead@jalwa.local',
  false, false, false, false,
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = 'eso-public-videos-link'
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://www.eso.org/public/videos/'
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = 'https://www.eso.org/public/videos/'
      and rr.status = 'pending'
  );


select json_build_object(
  'draft_count', (select count(*) from content_items where status='draft' and slug in ('mossy-tree-cc0','baking-cookies-cc0','ocean-surface-waves-cc0','tiny-waterfall-cc0','how-fossils-form-cc-by','tree-trimmer-cc0','artemis-ii-lunar-flyby-svs','artemis-ii-trajectory-svs','earthrise-45th-svs','eso-cast-254-light','counting-chisenbop-cc0','vhs-static-cc0-clip','earth-views-from-iss-nasa','hst-fly-by-nasa','hd-earth-views-svs','artemis-i-overview-svs','grca-south-rim-summer-timelapse','grca-animals-broll','eso-cast-265-light','eso-vista-cosmos-zoom','proxima-centauri-flythrough-cc-by','chauntra-village-spring','khyber-karma-dvids','op-mustang-dvids','rawhide-ii-border-hub-dvids','invitation-to-pakistan-nara','vanellus-vanellus-cc0','eastern-hindu-kush-lowari','hunza-valley-wle-2018','indus-kotri-barrage','big-buck-bunny','sintel','elephants-dream','sprite-fright','artemis-science-lunar-flyby-svs','proxima-centauri-eso-medium','grca-south-rim-winter-scenic','wikipedia-science-comms-cc-by','promise-of-pakistan-geography','hst-sm4-rendezvous-nasa','tears-of-steel','spring-blender','cosmos-laundromat','caminandes-llamigos','apollo-11-eagle-has-landed','huamei-bird-calling-cc0','house-sparrow-tschilp-cc0','abrasive-bird-debate-cc0','nasa-images-library-home-link','eso-public-videos-link')),
  'pending_rights', (
    select count(*) from rights_records rr
    join content_items ci on ci.id = rr.content_id
    where ci.slug in ('mossy-tree-cc0','baking-cookies-cc0','ocean-surface-waves-cc0','tiny-waterfall-cc0','how-fossils-form-cc-by','tree-trimmer-cc0','artemis-ii-lunar-flyby-svs','artemis-ii-trajectory-svs','earthrise-45th-svs','eso-cast-254-light','counting-chisenbop-cc0','vhs-static-cc0-clip','earth-views-from-iss-nasa','hst-fly-by-nasa','hd-earth-views-svs','artemis-i-overview-svs','grca-south-rim-summer-timelapse','grca-animals-broll','eso-cast-265-light','eso-vista-cosmos-zoom','proxima-centauri-flythrough-cc-by','chauntra-village-spring','khyber-karma-dvids','op-mustang-dvids','rawhide-ii-border-hub-dvids','invitation-to-pakistan-nara','vanellus-vanellus-cc0','eastern-hindu-kush-lowari','hunza-valley-wle-2018','indus-kotri-barrage','big-buck-bunny','sintel','elephants-dream','sprite-fright','artemis-science-lunar-flyby-svs','proxima-centauri-eso-medium','grca-south-rim-winter-scenic','wikipedia-science-comms-cc-by','promise-of-pakistan-geography','hst-sm4-rendezvous-nasa','tears-of-steel','spring-blender','cosmos-laundromat','caminandes-llamigos','apollo-11-eagle-has-landed','huamei-bird-calling-cc0','house-sparrow-tschilp-cc0','abrasive-bird-debate-cc0','nasa-images-library-home-link','eso-public-videos-link') and rr.status='pending'
  )
);

commit;
