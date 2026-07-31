import { readFile } from "node:fs/promises";
import { extname } from "node:path";
import { pathToFileURL } from "node:url";

const contentTypes = new Set(["video", "short", "live", "audio", "article", "image_story", "quran", "quiz"]);
const hostingModes = new Set(["embed_only", "self_host_open", "self_host_owned", "partner_hosted", "external_link", "text_database"]);
const accessLevels = new Set(["public", "registered", "premium"]);
const languages = new Set(["en", "ur", "roman_ur", "multi"]);
const audiences = new Set(["general", "family", "kids", "teens", "adults"]);
const sensitivities = new Set(["standard", "religious_review", "farming_review", "health_review", "children_review", "current_affairs_review"]);
const providers = new Set(["youtube", "wikimedia", "openverse", "tanzil", "nasa", "pexels", "pixabay", "blender", "original", "partner", "other"]);
const placeholderHosts = new Set(["example.com", "www.example.com", "localhost"]);

function requiredString(value, field, errors, index, min = 1) {
  if (typeof value !== "string" || value.trim().length < min) errors.push(`item ${index}: ${field} is required`);
}

function validHttps(value, field, errors, index, allowPlaceholders) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") errors.push(`item ${index}: ${field} must use HTTPS`);
    if (!allowPlaceholders && placeholderHosts.has(url.hostname)) errors.push(`item ${index}: ${field} uses a placeholder host`);
  } catch {
    errors.push(`item ${index}: ${field} must be a valid URL`);
  }
}

function csvBoolean(value, field, rowNumber) {
  if (value === "") return false;
  if (/^(true|yes|1)$/i.test(value)) return true;
  if (/^(false|no|0)$/i.test(value)) return false;
  throw new Error(`CSV row ${rowNumber}: ${field} must be true or false`);
}

export function parseCatalogueCsv(source) {
  const rows = [];
  let row = [];
  let field = "";
  let quoted = false;

  for (let index = 0; index < source.length; index += 1) {
    const character = source[index];
    if (quoted) {
      if (character === '"' && source[index + 1] === '"') {
        field += '"';
        index += 1;
      } else if (character === '"') {
        quoted = false;
      } else {
        field += character;
      }
      continue;
    }
    if (character === '"') {
      quoted = true;
    } else if (character === ",") {
      row.push(field);
      field = "";
    } else if (character === "\n") {
      row.push(field);
      if (row.some((entry) => entry.trim() !== "")) rows.push(row);
      row = [];
      field = "";
    } else if (character !== "\r") {
      field += character;
    }
  }
  if (quoted) throw new Error("CSV contains an unterminated quoted field");
  row.push(field);
  if (row.some((entry) => entry.trim() !== "")) rows.push(row);
  if (rows.length < 2) return [];

  const headers = rows[0].map((entry) => entry.trim());
  if (new Set(headers).size !== headers.length) throw new Error("CSV contains duplicate headers");

  return rows.slice(1).map((values, offset) => {
    const rowNumber = offset + 2;
    const record = Object.fromEntries(headers.map((header, index) => [header, (values[index] ?? "").trim()]));
    const duration = record.durationSeconds === "" ? undefined : Number(record.durationSeconds);
    if (duration !== undefined && !Number.isInteger(duration)) throw new Error(`CSV row ${rowNumber}: durationSeconds must be an integer`);
    return {
      slug: record.slug,
      contentType: record.contentType,
      hostingMode: record.hostingMode,
      accessLevel: record.accessLevel,
      titleEn: record.titleEn,
      titleUr: record.titleUr,
      titleRomanUr: record.titleRomanUr,
      descriptionEn: record.descriptionEn,
      descriptionUr: record.descriptionUr || undefined,
      descriptionRomanUr: record.descriptionRomanUr || undefined,
      categorySlug: record.categorySlug,
      language: record.language,
      durationSeconds: duration,
      audience: record.audience,
      sensitivity: record.sensitivity,
      thumbnailUrl: record.thumbnailUrl || undefined,
      source: {
        provider: record["source.provider"],
        providerContentId: record["source.providerContentId"] || undefined,
        embedUrl: record["source.embedUrl"] || undefined,
        mediaUrl: record["source.mediaUrl"] || undefined,
        externalUrl: record["source.externalUrl"],
      },
      rights: {
        sourceUrl: record["rights.sourceUrl"],
        creator: record["rights.creator"],
        licenceCode: record["rights.licenceCode"],
        attributionText: record["rights.attributionText"],
        evidenceReference: record["rights.evidenceReference"],
        takedownContact: record["rights.takedownContact"],
        expiresAt: record["rights.expiresAt"] || undefined,
        jurisdictionNote: record["rights.jurisdictionNote"] || undefined,
        embeddingConfirmed: csvBoolean(record["rights.embeddingConfirmed"], "rights.embeddingConfirmed", rowNumber),
        selfHostingConfirmed: csvBoolean(record["rights.selfHostingConfirmed"], "rights.selfHostingConfirmed", rowNumber),
        commercialUseConfirmed: csvBoolean(record["rights.commercialUseConfirmed"], "rights.commercialUseConfirmed", rowNumber),
        modificationConfirmed: csvBoolean(record["rights.modificationConfirmed"], "rights.modificationConfirmed", rowNumber),
        reviewedByAi: false,
      },
    };
  });
}

export async function loadJsonLines(filePath) {
  const raw = await readFile(filePath, "utf8");
  const items = [];
  for (const [offset, sourceLine] of raw.split(/\r?\n/).entries()) {
    const line = sourceLine.trim();
    if (!line || line.startsWith("#")) continue;
    try {
      items.push(JSON.parse(line));
    } catch (error) {
      throw new Error(`Invalid JSON on line ${offset + 1}: ${error instanceof Error ? error.message : "parse error"}`);
    }
  }
  return items;
}

export async function loadCatalogueFile(filePath) {
  if (extname(filePath).toLowerCase() === ".csv") return parseCatalogueCsv(await readFile(filePath, "utf8"));
  return loadJsonLines(filePath);
}

export function validateLaunchCatalogue(items, { minimumItems = 1, allowPlaceholders = false } = {}) {
  const errors = [];
  const warnings = [];
  const slugs = new Set();
  const providerIds = new Set();
  const sourceUrls = new Set();

  if (!Array.isArray(items)) return { ok: false, errors: ["catalogue must be an array"], warnings, summary: { items: 0 } };
  if (items.length < minimumItems) errors.push(`catalogue contains ${items.length} items; minimum is ${minimumItems}`);

  items.forEach((item, offset) => {
    const index = offset + 1;
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      errors.push(`item ${index}: must be an object`);
      return;
    }

    requiredString(item.slug, "slug", errors, index, 3);
    if (typeof item.slug === "string") {
      if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(item.slug)) errors.push(`item ${index}: slug must be lowercase kebab-case`);
      if (slugs.has(item.slug)) errors.push(`item ${index}: duplicate slug ${item.slug}`);
      slugs.add(item.slug);
    }

    if (!contentTypes.has(item.contentType)) errors.push(`item ${index}: unsupported contentType`);
    if (!hostingModes.has(item.hostingMode)) errors.push(`item ${index}: unsupported hostingMode`);
    if (!accessLevels.has(item.accessLevel)) errors.push(`item ${index}: unsupported accessLevel`);
    if (!languages.has(item.language)) errors.push(`item ${index}: unsupported language`);
    if (!audiences.has(item.audience)) errors.push(`item ${index}: unsupported audience`);
    if (!sensitivities.has(item.sensitivity)) errors.push(`item ${index}: unsupported sensitivity`);

    requiredString(item.titleEn, "titleEn", errors, index, 2);
    requiredString(item.titleUr, "titleUr", errors, index, 2);
    requiredString(item.titleRomanUr, "titleRomanUr", errors, index, 2);
    requiredString(item.descriptionEn, "descriptionEn", errors, index, 20);
    requiredString(item.categorySlug, "categorySlug", errors, index, 2);

    if (item.durationSeconds != null && (!Number.isInteger(item.durationSeconds) || item.durationSeconds < 0)) errors.push(`item ${index}: durationSeconds must be a non-negative integer`);
    if (item.thumbnailUrl) validHttps(item.thumbnailUrl, "thumbnailUrl", errors, index, allowPlaceholders);

    const source = item.source;
    if (!source || typeof source !== "object") {
      errors.push(`item ${index}: source is required`);
    } else {
      if (!providers.has(source.provider)) errors.push(`item ${index}: unsupported source provider`);
      requiredString(source.externalUrl, "source.externalUrl", errors, index, 8);
      if (source.externalUrl) {
        validHttps(source.externalUrl, "source.externalUrl", errors, index, allowPlaceholders);
        if (sourceUrls.has(source.externalUrl)) errors.push(`item ${index}: duplicate source URL ${source.externalUrl}`);
        sourceUrls.add(source.externalUrl);
      }
      if (source.providerContentId) {
        const key = `${source.provider}:${source.providerContentId}`;
        if (providerIds.has(key)) errors.push(`item ${index}: duplicate provider content id ${key}`);
        providerIds.add(key);
      }
      if (source.provider === "youtube") {
        if (!/^[A-Za-z0-9_-]{11}$/.test(source.providerContentId ?? "")) errors.push(`item ${index}: invalid YouTube video id`);
        try {
          const embed = new URL(source.embedUrl);
          if (embed.protocol !== "https:" || embed.hostname !== "www.youtube-nocookie.com" || !embed.pathname.startsWith("/embed/")) errors.push(`item ${index}: YouTube embedUrl must use youtube-nocookie.com/embed`);
        } catch {
          errors.push(`item ${index}: valid YouTube embedUrl is required`);
        }
      }
      if (["self_host_open", "self_host_owned"].includes(item.hostingMode) && !source.mediaUrl) warnings.push(`item ${index}: self-hosted source has no mediaUrl; media must be uploaded before publication`);
    }

    const rights = item.rights;
    if (!rights || typeof rights !== "object") {
      errors.push(`item ${index}: rights is required`);
    } else {
      requiredString(rights.sourceUrl, "rights.sourceUrl", errors, index, 8);
      requiredString(rights.creator, "rights.creator", errors, index, 2);
      requiredString(rights.licenceCode, "rights.licenceCode", errors, index, 2);
      requiredString(rights.attributionText, "rights.attributionText", errors, index, 8);
      requiredString(rights.evidenceReference, "rights.evidenceReference", errors, index, 4);
      requiredString(rights.takedownContact, "rights.takedownContact", errors, index, 4);
      if (rights.sourceUrl) validHttps(rights.sourceUrl, "rights.sourceUrl", errors, index, allowPlaceholders);
      if (rights.expiresAt) {
        const expiry = new Date(rights.expiresAt).getTime();
        if (!Number.isFinite(expiry)) errors.push(`item ${index}: rights.expiresAt must be a valid date`);
        else if (expiry <= Date.now()) errors.push(`item ${index}: rights.expiresAt is already expired`);
      }
      if (item.hostingMode === "embed_only" && rights.embeddingConfirmed !== true) errors.push(`item ${index}: embed_only requires embeddingConfirmed=true`);
      if (["self_host_open", "self_host_owned"].includes(item.hostingMode) && rights.selfHostingConfirmed !== true) errors.push(`item ${index}: self-hosting rights must be confirmed`);
      if ((["self_host_open", "self_host_owned"].includes(item.hostingMode) || item.accessLevel === "premium") && rights.commercialUseConfirmed !== true) errors.push(`item ${index}: self-hosted or premium content requires commercialUseConfirmed=true`);
      if (rights.reviewedByAi === true) errors.push(`item ${index}: AI cannot approve rights`);
    }
  });

  const summary = {
    items: items.length,
    premium: items.filter((item) => item?.accessLevel === "premium").length,
    shorts: items.filter((item) => item?.contentType === "short").length,
    live: items.filter((item) => item?.contentType === "live").length,
    categories: new Set(items.map((item) => item?.categorySlug).filter(Boolean)).size,
  };
  return { ok: errors.length === 0, errors, warnings, summary };
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) throw new Error("Usage: node scripts/launch-catalogue.mjs <catalogue.jsonl|catalogue.csv> [--min=150] [--allow-placeholders]");
  const minimumItems = Number(process.argv.find((arg) => arg.startsWith("--min="))?.split("=")[1] ?? 1);
  const allowPlaceholders = process.argv.includes("--allow-placeholders");
  const items = await loadCatalogueFile(filePath);
  const result = validateLaunchCatalogue(items, { minimumItems, allowPlaceholders });
  console.log(JSON.stringify(result, null, 2));
  if (!result.ok) process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  });
}
