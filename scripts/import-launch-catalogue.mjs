import { pathToFileURL } from "node:url";
import { loadCatalogueFile, validateLaunchCatalogue } from "./launch-catalogue.mjs";

function env(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is required`);
  return value;
}

async function request(baseUrl, key, path, init = {}) {
  const response = await fetch(`${baseUrl.replace(/\/$/, "")}${path}`, {
    ...init,
    headers: { apikey: key, Authorization: `Bearer ${key}`, "content-type": "application/json", ...(init.headers ?? {}) },
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) throw new Error(`${init.method ?? "GET"} ${path} failed (${response.status}): ${text}`);
  return data;
}

async function categoryId(baseUrl, key, slug) {
  const params = new URLSearchParams({ select: "id", slug: `eq.${slug}`, limit: "1" });
  const rows = await request(baseUrl, key, `/rest/v1/categories?${params}`);
  if (!rows?.[0]?.id) throw new Error(`Category not found: ${slug}`);
  return rows[0].id;
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

async function importItem(baseUrl, key, item) {
  const category = await categoryId(baseUrl, key, item.categorySlug);
  const contentRows = await request(baseUrl, key, "/rest/v1/content_items?on_conflict=slug", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=representation" },
    body: JSON.stringify([{ slug: item.slug, content_type: item.contentType, hosting_mode: item.hostingMode, access_level: item.accessLevel, status: "draft", title_en: item.titleEn, title_ur: item.titleUr, title_roman_ur: item.titleRomanUr, description_en: item.descriptionEn, description_ur: item.descriptionUr ?? null, description_roman_ur: item.descriptionRomanUr ?? null, primary_category_id: category, language: item.language, duration_seconds: item.durationSeconds ?? null, audience: item.audience, sensitivity: item.sensitivity, thumbnail_url: item.thumbnailUrl ?? null }]),
  });
  const contentId = contentRows?.[0]?.id;
  if (!contentId) throw new Error(`Content upsert returned no id for ${item.slug}`);

  const source = item.source;
  await request(baseUrl, key, "/rest/v1/playback_sources?on_conflict=provider,provider_content_id", {
    method: "POST",
    headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    body: JSON.stringify([{ content_id: contentId, provider: source.provider, provider_content_id: source.providerContentId ?? null, embed_url: source.embedUrl ?? null, media_url: source.mediaUrl ?? null, external_url: source.externalUrl ?? null, is_primary: true, status: "active" }]),
  });

  const rightsParams = new URLSearchParams({ select: "id,status", content_id: `eq.${contentId}`, source_url: `eq.${item.rights.sourceUrl}`, limit: "1" });
  const existingRights = await request(baseUrl, key, `/rest/v1/rights_records?${rightsParams}`);
  const rightsPayload = {
    content_id: contentId,
    source_url: item.rights.sourceUrl,
    creator: item.rights.creator,
    licence_code: item.rights.licenceCode,
    attribution_text: item.rights.attributionText,
    jurisdiction_note: item.rights.jurisdictionNote ?? null,
    ...evidenceFields(item.rights.evidenceReference),
    takedown_contact: item.rights.takedownContact,
    expires_at: item.rights.expiresAt ?? null,
    commercial_use_confirmed: item.rights.commercialUseConfirmed === true,
    modification_confirmed: item.rights.modificationConfirmed === true,
    self_hosting_confirmed: item.rights.selfHostingConfirmed === true,
    embedding_confirmed: item.rights.embeddingConfirmed === true,
    status: "pending",
    verified_by: null,
    verified_at: null,
  };

  if (!existingRights?.length) {
    await request(baseUrl, key, "/rest/v1/rights_records", {
      method: "POST",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify([rightsPayload]),
    });
  } else if (existingRights[0].status !== "approved") {
    await request(baseUrl, key, `/rest/v1/rights_records?id=eq.${existingRights[0].id}`, {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify(rightsPayload),
    });
  }

  return { slug: item.slug, contentId, preservedApprovedRights: existingRights?.[0]?.status === "approved" };
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

  const baseUrl = env("NEXT_PUBLIC_SUPABASE_URL");
  const key = env("SUPABASE_SERVICE_ROLE_KEY");
  const imported = [];
  for (const item of items) imported.push(await importItem(baseUrl, key, item));
  console.log(JSON.stringify({ mode: "commit", imported }, null, 2));
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
