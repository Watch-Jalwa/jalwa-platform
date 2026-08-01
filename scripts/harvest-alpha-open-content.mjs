#!/usr/bin/env node

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const REJECTED_LICENSE = /\b(nc|nd|noncommercial|no derivatives|all rights reserved)\b/i;
const DEFAULT_LIMIT = 1000;
const MAX_LIMIT = 50000;

function argument(name, fallback = null) {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] ?? fallback : fallback;
}

function hasFlag(name) {
  return process.argv.includes(`--${name}`);
}

function boundedLimit() {
  const raw = Number(argument("limit", DEFAULT_LIMIT));
  if (!Number.isInteger(raw) || raw < 1 || raw > MAX_LIMIT) {
    throw new Error(`--limit must be between 1 and ${MAX_LIMIT}`);
  }
  return raw;
}

function text(value) {
  if (typeof value === "string") return value.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  if (Array.isArray(value)) return value.map(text).filter(Boolean).join(", ");
  return "";
}

function normalizeLicense(value) {
  const raw = text(value).replaceAll("_", " ").trim();
  if (!raw || REJECTED_LICENSE.test(raw)) return null;
  const compact = raw.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  if (/^(cc0|creative commons zero)( \d \d)?$/.test(compact)) return compact.match(/\d \d$/) ? `CC0 ${compact.slice(-3).replace(" ", ".")}` : "CC0";
  if (/^(public domain|public domain mark|pdm)( \d \d)?$/.test(compact)) return "Public Domain Mark";
  if (/^(cc |creative commons )?by sa( \d \d)?$/.test(compact)) return compact.match(/\d \d$/) ? `CC BY-SA ${compact.slice(-3).replace(" ", ".")}` : "CC BY-SA";
  if (/^(cc |creative commons )?by( \d \d)?$/.test(compact)) return compact.match(/\d \d$/) ? `CC BY ${compact.slice(-3).replace(" ", ".")}` : "CC BY";
  return null;
}

function mediaTypeFor(source) {
  const media = source.primaryMedia.toLowerCase();
  if (media.includes("video") || media.includes("animation")) return "video";
  if (media.includes("audio") || media.includes("music")) return "audio";
  if (media.includes("3d")) return "3d";
  if (media.includes("map")) return "map";
  return "image";
}

async function fetchJson(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: {
      "User-Agent": "JalwaAlphaHarvester/1.0 rights-first metadata-only",
      Accept: "application/json",
      ...(options.headers ?? {}),
    },
    signal: AbortSignal.timeout(Number(process.env.HARVEST_TIMEOUT_MS ?? 30000)),
  });
  if (!response.ok) throw new Error(`${url} returned ${response.status}`);
  return response.json();
}

function sourceQuery(source) {
  return source.provider
    .replace(/[—–-].*$/, "")
    .replace(/\b(CC0|CC BY-SA|CC BY|Public Domain|open access|collection subset|items?)\b/gi, "")
    .trim() || source.contentLane;
}

async function harvestWikimedia(source, limit) {
  const results = [];
  let offset = 0;
  while (results.length < limit) {
    const batch = Math.min(50, limit - results.length);
    const params = new URLSearchParams({
      action: "query",
      format: "json",
      origin: "*",
      generator: "search",
      gsrnamespace: "6",
      gsrsearch: sourceQuery(source),
      gsrlimit: String(batch),
      gsroffset: String(offset),
      prop: "imageinfo",
      iiprop: "url|mime|size|extmetadata",
    });
    const payload = await fetchJson(`https://commons.wikimedia.org/w/api.php?${params}`);
    const pages = Object.values(payload.query?.pages ?? {});
    if (!pages.length) break;
    for (const page of pages) {
      const info = page.imageinfo?.[0];
      const meta = info?.extmetadata ?? {};
      const licenceCode = normalizeLicense(meta.LicenseShortName?.value);
      if (!licenceCode) continue;
      const mime = text(info?.mime).toLowerCase();
      const detectedMediaType = mime.startsWith("video/") ? "video" : mime.startsWith("audio/") ? "audio" : mime.startsWith("image/") ? "image" : mediaTypeFor(source);
      const sourceUrl = info?.descriptionurl || `https://commons.wikimedia.org/?curid=${page.pageid}`;
      results.push({
        sourceId: source.sourceId,
        externalId: String(page.pageid),
        title: text(meta.ObjectName?.value) || text(page.title).replace(/^File:/, ""),
        description: text(meta.ImageDescription?.value),
        mediaType: detectedMediaType,
        language: source.languages,
        creator: text(meta.Artist?.value) || text(meta.Credit?.value),
        licenceCode,
        licenceUrl: text(meta.LicenseUrl?.value),
        sourceUrl,
        directMediaUrl: info?.url ?? null,
        thumbnailUrl: info?.thumburl ?? info?.url ?? null,
        rightsState: "candidate",
        metadata: {
          width: info?.width ?? null,
          height: info?.height ?? null,
          restrictions: text(meta.Restrictions?.value),
          sourceProvider: "wikimedia",
        },
      });
      if (results.length >= limit) break;
    }
    if (!payload.continue?.gsroffset) break;
    offset = payload.continue.gsroffset;
  }
  return results;
}

async function harvestNasa(source, limit) {
  const results = [];
  const mediaType = mediaTypeFor(source);
  for (let page = 1; results.length < limit; page += 1) {
    const params = new URLSearchParams({
      q: sourceQuery(source),
      media_type: ["video", "audio", "image"].includes(mediaType) ? mediaType : "image",
      page_size: String(Math.min(100, limit - results.length)),
      page: String(page),
    });
    const payload = await fetchJson(`https://images-api.nasa.gov/search?${params}`);
    const items = payload.collection?.items ?? [];
    if (!items.length) break;
    for (const item of items) {
      const data = item.data?.[0] ?? {};
      const preview = item.links?.find((link) => link.rel === "preview")?.href ?? null;
      results.push({
        sourceId: source.sourceId,
        externalId: data.nasa_id || item.href,
        title: text(data.title) || data.nasa_id,
        description: text(data.description_508 || data.description),
        mediaType: data.media_type || mediaType,
        language: data.language || source.languages,
        creator: text(data.photographer || data.secondary_creator || data.center) || "NASA",
        licenceCode: "US-GOV-PD-ITEM-CHECK",
        licenceUrl: source.rightsEvidenceUrl,
        sourceUrl: data.nasa_id ? `https://images.nasa.gov/details/${encodeURIComponent(data.nasa_id)}` : item.href,
        directMediaUrl: null,
        thumbnailUrl: preview,
        rightsState: "candidate",
        metadata: {
          nasaId: data.nasa_id,
          dateCreated: data.date_created,
          keywords: data.keywords ?? [],
          center: data.center ?? null,
          itemReviewRequired: true,
          sourceProvider: "nasa",
        },
      });
      if (results.length >= limit) break;
    }
    if (!payload.collection?.links?.some((link) => link.rel === "next")) break;
  }
  return results;
}

async function harvestMet(source, limit) {
  const search = await fetchJson("https://collectionapi.metmuseum.org/public/collection/v1/search?hasImages=true&q=open%20access");
  const ids = (search.objectIDs ?? []).slice(0, limit * 2);
  const results = [];
  for (const id of ids) {
    const item = await fetchJson(`https://collectionapi.metmuseum.org/public/collection/v1/objects/${id}`);
    if (!item.isPublicDomain || !item.primaryImage) continue;
    results.push({
      sourceId: source.sourceId,
      externalId: String(item.objectID),
      title: text(item.title) || `Met object ${item.objectID}`,
      description: text([item.objectName, item.period, item.culture, item.objectDate]),
      mediaType: "image",
      language: source.languages,
      creator: text(item.artistDisplayName) || "Unknown",
      licenceCode: "CC0",
      licenceUrl: source.rightsEvidenceUrl,
      sourceUrl: item.objectURL,
      directMediaUrl: item.primaryImage,
      thumbnailUrl: item.primaryImageSmall || item.primaryImage,
      rightsState: "candidate",
      metadata: {
        department: item.department,
        accessionNumber: item.accessionNumber,
        sourceProvider: "met",
      },
    });
    if (results.length >= limit) break;
  }
  return results;
}

async function harvestArtic(source, limit) {
  const results = [];
  for (let page = 1; results.length < limit; page += 1) {
    const fields = [
      "id", "title", "thumbnail", "image_id", "artist_display", "date_display",
      "is_public_domain", "api_link", "license_text",
    ].join(",");
    const payload = await fetchJson(`https://api.artic.edu/api/v1/artworks/search?q=public%20domain&limit=${Math.min(100, limit - results.length)}&page=${page}&fields=${fields}`);
    for (const item of payload.data ?? []) {
      if (!item.is_public_domain || !item.image_id) continue;
      const image = `${payload.config?.iiif_url}/${item.image_id}/full/843,/0/default.jpg`;
      results.push({
        sourceId: source.sourceId,
        externalId: String(item.id),
        title: text(item.title) || `Art Institute object ${item.id}`,
        description: text([item.artist_display, item.date_display]),
        mediaType: "image",
        language: source.languages,
        creator: text(item.artist_display) || "Unknown",
        licenceCode: "CC0",
        licenceUrl: source.rightsEvidenceUrl,
        sourceUrl: item.api_link,
        directMediaUrl: image,
        thumbnailUrl: image,
        rightsState: "candidate",
        metadata: {
          altText: text(item.thumbnail?.alt_text),
          sourceProvider: "artic",
        },
      });
      if (results.length >= limit) break;
    }
    if (!payload.pagination?.next_url) break;
  }
  return results;
}

async function harvestCleveland(source, limit) {
  const payload = await fetchJson(`https://openaccess-api.clevelandart.org/api/artworks/?cc0=1&has_image=1&limit=${Math.min(limit, 1000)}`);
  return (payload.data ?? []).slice(0, limit).map((item) => ({
    sourceId: source.sourceId,
    externalId: String(item.id),
    title: text(item.title) || `Cleveland Museum object ${item.id}`,
    description: text(item.wall_description || item.description),
    mediaType: "image",
    language: source.languages,
    creator: text(item.creators?.map((creator) => creator.description)) || "Unknown",
    licenceCode: "CC0",
    licenceUrl: source.rightsEvidenceUrl,
    sourceUrl: item.url,
    directMediaUrl: item.images?.web?.url ?? null,
    thumbnailUrl: item.images?.print?.url ?? item.images?.web?.url ?? null,
    rightsState: "candidate",
    metadata: {
      accessionNumber: item.accession_number,
      culture: item.culture,
      sourceProvider: "cleveland",
    },
  }));
}

async function harvestOpenverse(source, limit) {
  const mediaType = source.primaryMedia.toLowerCase().includes("audio") ? "audio" : "images";
  const licence = /CC0/i.test(source.rightsBasis) ? "cc0" : /BY-SA/i.test(source.rightsBasis) ? "by-sa" : "by";
  const results = [];
  for (let page = 1; results.length < limit; page += 1) {
    const params = new URLSearchParams({
      q: source.contentLane,
      license: licence,
      page_size: String(Math.min(100, limit - results.length)),
      page: String(page),
    });
    const payload = await fetchJson(`https://api.openverse.org/v1/${mediaType}/?${params}`);
    const items = payload.results ?? [];
    if (!items.length) break;
    for (const item of items) {
      const licenceCode = normalizeLicense(item.license);
      if (!licenceCode) continue;
      results.push({
        sourceId: source.sourceId,
        externalId: String(item.id),
        title: text(item.title) || `Openverse ${item.id}`,
        description: text(item.description),
        mediaType: mediaType === "images" ? "image" : "audio",
        language: source.languages,
        creator: text(item.creator),
        licenceCode,
        licenceUrl: item.license_url,
        sourceUrl: item.foreign_landing_url,
        directMediaUrl: item.url,
        thumbnailUrl: item.thumbnail,
        rightsState: "candidate",
        metadata: {
          provider: item.provider,
          source: item.source,
          itemReviewRequired: true,
          sourceProvider: "openverse",
        },
      });
      if (results.length >= limit) break;
    }
    if (!payload.next) break;
  }
  return results;
}

async function harvestSmithsonian(source, limit) {
  const apiKey = process.env.SMITHSONIAN_API_KEY;
  if (!apiKey) throw new Error("SMITHSONIAN_API_KEY is required for Smithsonian harvesting.");
  const results = [];
  for (let start = 0; results.length < limit; start += 100) {
    const params = new URLSearchParams({
      api_key: apiKey,
      q: `${sourceQuery(source)} AND online_media_type:Images`,
      rows: String(Math.min(100, limit - results.length)),
      start: String(start),
    });
    const payload = await fetchJson(`https://api.si.edu/openaccess/api/v1.0/search?${params}`);
    const rows = payload.response?.rows ?? [];
    if (!rows.length) break;
    for (const row of rows) {
      const media = row.content?.descriptiveNonRepeating?.online_media?.media?.[0];
      const usage = text(row.content?.descriptiveNonRepeating?.online_media?.usage);
      if (!/CC0/i.test(usage)) continue;
      results.push({
        sourceId: source.sourceId,
        externalId: String(row.id),
        title: text(row.title) || String(row.id),
        description: text(row.content?.freetext?.notes?.map((note) => note.content)),
        mediaType: "image",
        language: source.languages,
        creator: text(row.content?.freetext?.name?.map((name) => name.content)),
        licenceCode: "CC0",
        licenceUrl: source.rightsEvidenceUrl,
        sourceUrl: row.content?.descriptiveNonRepeating?.record_link || source.sourceUrl,
        directMediaUrl: media?.content ?? null,
        thumbnailUrl: media?.thumbnail ?? media?.content ?? null,
        rightsState: "candidate",
        metadata: {
          unitCode: row.unitCode,
          usage,
          sourceProvider: "smithsonian",
        },
      });
      if (results.length >= limit) break;
    }
  }
  return results;
}

function adapterFor(source) {
  if (source.sourceId.startsWith("WM-")) return harvestWikimedia;
  if (source.sourceId.startsWith("NA-")) return harvestNasa;
  if (source.sourceId === "MU-001") return harvestMet;
  if (source.sourceId === "MU-002") return harvestArtic;
  if (source.sourceId === "MU-003") return harvestCleveland;
  if (source.sourceId.startsWith("SM-")) return harvestSmithsonian;
  if (/^DS-00[6-7]$/.test(source.sourceId)) return harvestOpenverse;
  return null;
}

async function importCandidates(candidates) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!baseUrl || !serviceRole) throw new Error("Supabase service-role configuration is required for --import.");
  const headers = {
    apikey: serviceRole,
    Authorization: `Bearer ${serviceRole}`,
    "Content-Type": "application/json",
  };
  const sourceIds = [...new Set(candidates.map((candidate) => candidate.sourceId))];
  const params = new URLSearchParams({
    select: "id,source_key",
    source_key: `in.(${sourceIds.join(",")})`,
  });
  const sourceResponse = await fetch(`${baseUrl}/rest/v1/source_accounts?${params}`, { headers });
  if (!sourceResponse.ok) throw new Error(`Source lookup failed: ${sourceResponse.status}`);
  const sourceRows = await sourceResponse.json();
  const sourceMap = new Map(sourceRows.map((row) => [row.source_key, row.id]));
  const normalized = candidates.map((candidate) => {
    const sourceAccountId = sourceMap.get(candidate.sourceId);
    if (!sourceAccountId) throw new Error(`Source ${candidate.sourceId} is not installed.`);
    return {
      source_account_id: sourceAccountId,
      external_id: candidate.externalId,
      source_url: candidate.sourceUrl,
      title: candidate.title,
      description: candidate.description || null,
      media_type: candidate.mediaType || null,
      language: candidate.language || null,
      creator: candidate.creator || null,
      licence_code: candidate.licenceCode || null,
      licence_url: candidate.licenceUrl || null,
      direct_media_url: candidate.directMediaUrl || null,
      thumbnail_url: candidate.thumbnailUrl || null,
      rights_state: "candidate",
      ingestion_status: "discovered",
      metadata: candidate.metadata ?? {},
    };
  });
  for (let index = 0; index < normalized.length; index += 100) {
    const response = await fetch(`${baseUrl}/rest/v1/source_items?on_conflict=source_account_id,external_id`, {
      method: "POST",
      headers: {
        ...headers,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify(normalized.slice(index, index + 100)),
    });
    if (!response.ok) throw new Error(`Source-item import failed: ${response.status} ${await response.text()}`);
  }
}

async function main() {
  const limit = boundedLimit();
  const selected = argument("source");
  const output = resolve(argument("out", "artifacts/alpha-source-candidates.jsonl"));
  const raw = await readFile(new URL("../content/alpha-approved-sources.json", import.meta.url), "utf8");
  const register = JSON.parse(raw);
  const sources = register.sources.filter((source) => !selected || source.sourceId === selected);
  if (selected && !sources.length) throw new Error(`Unknown source ID: ${selected}`);

  const candidates = [];
  for (const source of sources) {
    if (!source.copyrightApproved) continue;
    const adapter = adapterFor(source);
    if (!adapter) {
      console.log(JSON.stringify({ event: "source_skipped", sourceId: source.sourceId, reason: "metadata_adapter_not_implemented" }));
      continue;
    }
    const remaining = limit - candidates.length;
    if (remaining <= 0) break;
    try {
      const harvested = await adapter(source, remaining);
      candidates.push(...harvested);
      console.log(JSON.stringify({ event: "source_harvested", sourceId: source.sourceId, count: harvested.length }));
    } catch (error) {
      console.error(JSON.stringify({
        event: "source_harvest_failed",
        sourceId: source.sourceId,
        error: error instanceof Error ? error.message : String(error),
      }));
      if (selected) throw error;
    }
  }

  await mkdir(dirname(output), { recursive: true });
  await writeFile(output, candidates.map((candidate) => JSON.stringify(candidate)).join("\n") + (candidates.length ? "\n" : ""));
  if (hasFlag("import") && candidates.length) await importCandidates(candidates);
  console.log(JSON.stringify({
    event: "alpha_harvest_complete",
    candidates: candidates.length,
    output,
    imported: hasFlag("import"),
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : error);
  process.exit(1);
});
