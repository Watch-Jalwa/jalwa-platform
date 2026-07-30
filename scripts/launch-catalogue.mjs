import { readFile } from "node:fs/promises";
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

export function validateLaunchCatalogue(items, { minimumItems = 1, allowPlaceholders = false } = {}) {
  const errors = [];
  const warnings = [];
  const slugs = new Set();
  const providerIds = new Set();

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
      if (source.externalUrl) validHttps(source.externalUrl, "source.externalUrl", errors, index, allowPlaceholders);
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
      if (rights.sourceUrl) validHttps(rights.sourceUrl, "rights.sourceUrl", errors, index, allowPlaceholders);
      if (item.hostingMode === "embed_only" && rights.embeddingConfirmed !== true) errors.push(`item ${index}: embed_only requires embeddingConfirmed=true`);
      if (["self_host_open", "self_host_owned"].includes(item.hostingMode) && rights.selfHostingConfirmed !== true) errors.push(`item ${index}: self-hosting rights must be confirmed`);
      if (item.hostingMode === "self_host_open" && rights.commercialUseConfirmed !== true) errors.push(`item ${index}: open content requires commercialUseConfirmed=true`);
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
  if (!filePath) throw new Error("Usage: node scripts/launch-catalogue.mjs <catalogue.jsonl> [--min=150] [--allow-placeholders]");
  const minimumItems = Number(process.argv.find((arg) => arg.startsWith("--min="))?.split("=")[1] ?? 1);
  const allowPlaceholders = process.argv.includes("--allow-placeholders");
  const items = await loadJsonLines(filePath);
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
