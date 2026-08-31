import { pathToFileURL } from "node:url";
import { createDatabaseClient, createPool } from "@jalwa/postgres";
import { loadCatalogueFile, validateLaunchCatalogue } from "./launch-catalogue.mjs";

function env(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

function evidenceFields(reference) {
  try {
    const url = new URL(reference);
    if (url.protocol === "https:") return { evidence_url: reference, evidence_note: null };
  } catch {
    // Internal document references are stored as notes and resolved by operations.
  }
  return { evidence_url: null, evidence_note: reference };
}

async function upsertContentDraft(database, item, category) {
  const { data: existing, error: existingError } = await database.from("content_items").select("id,status").eq("slug", item.slug).maybeSingle();
  if (existingError) throw existingError;
  const payload = {
    slug: item.slug, content_type: item.contentType, hosting_mode: item.hostingMode, access_level: item.accessLevel,
    title_en: item.titleEn, title_ur: item.titleUr, title_roman_ur: item.titleRomanUr, description_en: item.descriptionEn,
    description_ur: item.descriptionUr ?? null, description_roman_ur: item.descriptionRomanUr ?? null,
    primary_category_id: category, language: item.language, duration_seconds: item.durationSeconds ?? null,
    audience: item.audience, sensitivity: item.sensitivity, thumbnail_url: item.thumbnailUrl ?? null,
  };
  if (existing?.id) {
    const { data, error } = await database.from("content_items").update(payload).eq("id", existing.id).select("id").single();
    if (error) throw error;
    return { contentId: data.id, preservedStatus: existing.status };
  }
  const { data, error } = await database.from("content_items").insert({ ...payload, status: "draft" }).select("id").single();
  if (error) throw error;
  return { contentId: data.id, preservedStatus: null };
}

async function importItem(database, item) {
  const { data: category, error: categoryError } = await database.from("categories").select("id").eq("slug", item.categorySlug).maybeSingle();
  if (categoryError) throw categoryError;
  if (!category?.id) throw new Error(`Category not found: ${item.categorySlug}`);
  const { contentId, preservedStatus } = await upsertContentDraft(database, item, category.id);

  const source = item.source;
  const { error: playbackError } = await database.from("playback_sources").upsert({
    content_id: contentId, provider: source.provider, provider_content_id: source.providerContentId ?? null,
    embed_url: source.embedUrl ?? null, media_url: source.mediaUrl ?? null, external_url: source.externalUrl ?? null,
    is_primary: true, status: "active",
  }, { onConflict: "provider,provider_content_id" });
  if (playbackError) throw playbackError;

  const { data: existingRights, error: rightsLookupError } = await database.from("rights_records")
    .select("id,status").eq("content_id", contentId).eq("source_url", item.rights.sourceUrl).maybeSingle();
  if (rightsLookupError) throw rightsLookupError;
  const rightsPayload = {
    content_id: contentId, source_url: item.rights.sourceUrl, creator: item.rights.creator, licence_code: item.rights.licenceCode,
    attribution_text: item.rights.attributionText, jurisdiction_note: item.rights.jurisdictionNote ?? null,
    ...evidenceFields(item.rights.evidenceReference), takedown_contact: item.rights.takedownContact,
    expires_at: item.rights.expiresAt ?? null, commercial_use_confirmed: item.rights.commercialUseConfirmed === true,
    modification_confirmed: item.rights.modificationConfirmed === true, self_hosting_confirmed: item.rights.selfHostingConfirmed === true,
    embedding_confirmed: item.rights.embeddingConfirmed === true, status: "pending", verified_by: null, verified_at: null,
  };
  if (!existingRights) {
    const { error } = await database.from("rights_records").insert(rightsPayload);
    if (error) throw error;
  } else if (existingRights.status !== "approved") {
    const { error } = await database.from("rights_records").update(rightsPayload).eq("id", existingRights.id);
    if (error) throw error;
  }
  return { slug: item.slug, contentId, preservedContentStatus: preservedStatus, preservedApprovedRights: existingRights?.status === "approved" };
}

async function main() {
  const filePath = process.argv[2];
  const commit = process.argv.includes("--commit");
  const minimumItems = Number(process.argv.find((arg) => arg.startsWith("--min="))?.split("=")[1] ?? 1);
  if (!filePath) throw new Error("Usage: node scripts/import-launch-catalogue.mjs <catalogue.jsonl|catalogue.csv> [--min=150] [--commit]");
  const items = await loadCatalogueFile(filePath);
  const validation = validateLaunchCatalogue(items, { minimumItems, allowPlaceholders: false });
  if (!validation.ok) {
    console.error(JSON.stringify(validation, null, 2));
    process.exitCode = 1;
    return;
  }
  if (!commit) {
    console.log(JSON.stringify({ mode: "dry-run", ...validation }, null, 2));
    return;
  }

  const pool = createPool(env("DATABASE_URL"), { max: 4 });
  const database = createDatabaseClient(pool, { role: "service_role" });
  try {
    const imported = [];
    for (const item of items) imported.push(await importItem(database, item));
    console.log(JSON.stringify({ mode: "commit", imported }, null, 2));
  } finally {
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
