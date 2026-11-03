import { readFileSync, writeFileSync, statSync } from "node:fs";

function lit(value) {
  if (value === null || value === undefined) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return Number.isFinite(value) ? String(Math.trunc(value)) : "null";
  return `'${String(value).replace(/'/g, "''")}'`;
}

const items = readFileSync("content/live-test-50-launch-catalogue.jsonl", "utf8")
  .trim()
  .split(/\n/)
  .map((line) => JSON.parse(line));

const parts = [
  "-- Generated live-test-50 draft intake for staging only.",
  "-- Draft + pending rights only. Never publishes. Never touches production.",
  "begin;",
  "select set_config('request.jwt.claim.role','service_role',true);",
  "set local role service_role;",
];

for (const item of items) {
  parts.push(`
-- ${item.slug}
with upserted as (
  insert into public.content_items (
    slug, content_type, hosting_mode, access_level, status,
    title_en, title_ur, title_roman_ur, description_en, description_ur, description_roman_ur,
    primary_category_id, language, duration_seconds, audience, sensitivity
  ) values (
    ${lit(item.slug)}, ${lit(item.contentType)}::public.content_type, ${lit(item.hostingMode)}::public.hosting_mode, ${lit(item.accessLevel)}::public.access_level, 'draft'::public.content_status,
    ${lit(item.titleEn)}, ${lit(item.titleUr)}, ${lit(item.titleRomanUr)}, ${lit(item.descriptionEn)}, ${lit(item.descriptionUr)}, ${lit(item.descriptionRomanUr)},
    (select id from public.categories where slug=${lit(item.categorySlug)}), ${lit(item.language)}, ${lit(item.durationSeconds ?? null)}, ${lit(item.audience)}, ${lit(item.sensitivity)}
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
  select id, ${lit(item.source.provider)}::public.source_provider, ${lit(item.source.providerContentId)}, ${lit(item.source.externalUrl)}, true, 'active'
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
  jsonb_build_object('slug', ${lit(item.slug)}, 'source_url', ${lit(item.source.externalUrl)}, 'hosting_mode', ${lit(item.hostingMode)}, 'importer', 'live-test-50-sql')
from upserted;

insert into public.rights_records (
  content_id, source_url, creator, licence_code, attribution_text, jurisdiction_note,
  evidence_url, evidence_note, takedown_contact,
  commercial_use_confirmed, modification_confirmed, self_hosting_confirmed, embedding_confirmed,
  status, verified_by, verified_at
)
select ci.id, ${lit(item.rights.sourceUrl)}, ${lit(item.rights.creator)}, ${lit(item.rights.licenceCode)}, ${lit(item.rights.attributionText)}, ${lit(item.rights.jurisdictionNote)},
  ${lit(item.rights.evidenceReference)}, null, ${lit(item.rights.takedownContact)},
  ${lit(Boolean(item.rights.commercialUseConfirmed))}, ${lit(Boolean(item.rights.modificationConfirmed))}, ${lit(Boolean(item.rights.selfHostingConfirmed))}, ${lit(Boolean(item.rights.embeddingConfirmed))},
  'pending'::public.rights_status, null, null
from public.content_items ci
where ci.slug = ${lit(item.slug)}
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = ${lit(item.rights.sourceUrl)}
      and rr.status = 'approved'
  )
  and not exists (
    select 1 from public.rights_records rr
    where rr.content_id = ci.id
      and rr.source_url = ${lit(item.rights.sourceUrl)}
      and rr.status = 'pending'
  );
`);
}

const slugList = items.map((item) => lit(item.slug)).join(",");
parts.push(`
select json_build_object(
  'draft_count', (select count(*) from content_items where status='draft' and slug in (${slugList})),
  'pending_rights', (
    select count(*) from rights_records rr
    join content_items ci on ci.id = rr.content_id
    where ci.slug in (${slugList}) and rr.status='pending'
  )
);
`);
parts.push("commit;");

writeFileSync("scripts/import-live-test-50-drafts-staging.sql", `${parts.join("\n")}\n`);
console.log(
  JSON.stringify({
    sqlBytes: statSync("scripts/import-live-test-50-drafts-staging.sql").size,
    items: items.length,
  }),
);
