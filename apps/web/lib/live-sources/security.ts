import "server-only";
import "./open-government-sources";

import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import {
  getLiveSourceDefinition,
  officialYouTubeEmbed,
  type LiveAvailability,
  type LiveSourceDefinition,
} from "./registry";

const MAX_REDIRECTS = 3;
const HTML_LIMIT_BYTES = 1_500_000;
const IMAGE_LIMIT_BYTES = 12_000_000;
const REQUEST_TIMEOUT_MS = 10_000;
const IMAGE_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);

type ExtendedLiveSourceDefinition = LiveSourceDefinition & { imagePathPattern?: string };

function privateIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return true;
  const a = parts[0] ?? -1;
  const b = parts[1] ?? -1;
  return a === 0 || a === 10 || a === 127 || a >= 224 || (a === 100 && b >= 64 && b <= 127)
    || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
    || (a === 192 && b === 168) || (a === 198 && (b === 18 || b === 19));
}

function privateIp(address: string) {
  const normalized = address.toLowerCase();
  if (isIP(normalized) === 4) return privateIpv4(normalized);
  if (isIP(normalized) === 6) {
    if (normalized === "::" || normalized === "::1" || normalized.startsWith("fc") || normalized.startsWith("fd")
      || normalized.startsWith("fe8") || normalized.startsWith("fe9") || normalized.startsWith("fea") || normalized.startsWith("feb")) return true;
    const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
    return mapped?.[1] ? privateIpv4(mapped[1]) : false;
  }
  return true;
}

export async function assertAllowedPublicHttps(value: string, allowedHosts: readonly string[]) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password) throw new Error("Live source must use public HTTPS.");
  const hostname = url.hostname.toLowerCase();
  if (!allowedHosts.some((host) => hostname === host.toLowerCase())) throw new Error("Live source host is not approved.");
  if (hostname === "localhost" || hostname.endsWith(".localhost") || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("Private live source host is not allowed.");
  }
  const addresses = await lookup(hostname, { all: true, verbatim: true });
  if (!addresses.length || addresses.some((entry) => privateIp(entry.address))) {
    throw new Error("Live source host resolves to a private or reserved address.");
  }
  return url;
}

async function fetchAllowed(value: string, definition: LiveSourceDefinition, method: "GET" | "HEAD" = "GET") {
  let url = await assertAllowedPublicHttps(value, definition.allowedHosts);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetch(url, {
      method,
      redirect: "manual",
      cache: "no-store",
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
      headers: {
        accept: method === "GET" ? "text/html,image/avif,image/webp,image/png,image/jpeg,image/gif;q=0.9,*/*;q=0.2" : "*/*",
        "user-agent": "Jalwa-Approved-Live/2.0 (+https://watch-jalwa.com)",
      },
    });
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location || redirect === MAX_REDIRECTS) throw new Error("Unsafe or excessive live-source redirects.");
      url = await assertAllowedPublicHttps(new URL(location, url).toString(), definition.allowedHosts);
      continue;
    }
    return { response, finalUrl: url };
  }
  throw new Error("Live source request failed.");
}

async function readBounded(response: Response, maxBytes: number) {
  const declared = Number(response.headers.get("content-length") ?? "0");
  if (Number.isFinite(declared) && declared > maxBytes) throw new Error("Live source response exceeds the size limit.");
  if (!response.body) return new Uint8Array();
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      if (!value) continue;
      total += value.byteLength;
      if (total > maxBytes) throw new Error("Live source response exceeds the size limit.");
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const output = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) {
    output.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return output;
}

function decodeHtml(bytes: Uint8Array) {
  return new TextDecoder("utf-8", { fatal: false }).decode(bytes);
}

function htmlAttributeUrls(html: string, attribute: "src" | "href") {
  const values: string[] = [];
  const pattern = new RegExp(`${attribute}\\s*=\\s*["']([^"']+)["']`, "gi");
  for (const match of html.matchAll(pattern)) if (match[1]) values.push(match[1]);
  return values;
}

function normalizeYouTubeEmbed(value: string) {
  const url = new URL(value);
  const embed = url.pathname.match(/\/embed\/([A-Za-z0-9_-]{11})/);
  if (embed?.[1]) return officialYouTubeEmbed(embed[1]);
  const watchId = url.searchParams.get("v");
  if (watchId && /^[A-Za-z0-9_-]{11}$/.test(watchId)) return officialYouTubeEmbed(watchId);
  return null;
}

export async function resolveOfficialEmbed(sourceKey: string): Promise<{
  availability: LiveAvailability;
  embedUrl: string | null;
  message: string | null;
}> {
  const definition = getLiveSourceDefinition(sourceKey);
  if (!definition || definition.adapter !== "official_live_embed") throw new Error("Unknown official live source.");
  if (definition.embedVideoId) return { availability: "healthy", embedUrl: officialYouTubeEmbed(definition.embedVideoId), message: null };

  const { response, finalUrl } = await fetchAllowed(definition.officialSourceUrl, definition);
  if (!response.ok) throw new Error(`Official live page returned HTTP ${response.status}.`);
  const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.toLowerCase() ?? "";
  if (contentType && !contentType.includes("html")) throw new Error("Official live page did not return HTML.");
  const html = decodeHtml(await readBounded(response, HTML_LIMIT_BYTES));
  const iframeUrls = htmlAttributeUrls(html, "src")
    .map((value) => { try { return new URL(value, finalUrl).toString(); } catch { return null; } })
    .filter((value): value is string => Boolean(value))
    .filter((value) => { try { return new URL(value).hostname.includes("youtube"); } catch { return false; } });
  const selected = iframeUrls[definition.iframeIndex ?? 0];
  const embedUrl = selected ? normalizeYouTubeEmbed(selected) : null;
  if (!embedUrl) {
    return definition.offAirAllowed
      ? { availability: "off_air", embedUrl: null, message: "The official source is currently off air." }
      : { availability: "unavailable", embedUrl: null, message: "The official player is currently unavailable." };
  }
  await assertAllowedPublicHttps(embedUrl, definition.allowedHosts);
  return { availability: "healthy", embedUrl, message: null };
}

function candidateImageUrls(html: string, baseUrl: URL) {
  const values: string[] = [];
  const metaPatterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/gi,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["'][^>]*>/gi,
  ];
  for (const pattern of metaPatterns) for (const match of html.matchAll(pattern)) if (match[1]) values.push(match[1]);
  values.push(...htmlAttributeUrls(html, "src"), ...htmlAttributeUrls(html, "href"));
  return values.map((value) => {
    try { return new URL(value, baseUrl).toString(); } catch { return null; }
  }).filter((value): value is string => Boolean(value));
}

export type ResolvedLiveImage = {
  bytes: Uint8Array;
  contentType: string;
  sourceUrl: string;
  etag: string | null;
  lastModified: string | null;
  contentHash: string;
};

export async function resolveLiveImage(sourceKey: string): Promise<ResolvedLiveImage> {
  const definition = getLiveSourceDefinition(sourceKey) as ExtendedLiveSourceDefinition | null;
  if (!definition || definition.adapter !== "public_domain_live_image" || !definition.imageUrl) {
    throw new Error("Unknown public-domain live image source.");
  }

  let current = definition.imageUrl;
  for (let discovery = 0; discovery < 2; discovery += 1) {
    const { response, finalUrl } = await fetchAllowed(current, definition);
    if (!response.ok) throw new Error(`Public-domain camera returned HTTP ${response.status}.`);
    const contentType = response.headers.get("content-type")?.split(";", 1)[0]?.trim().toLowerCase() ?? "";
    if (IMAGE_TYPES.has(contentType)) {
      const bytes = await readBounded(response, IMAGE_LIMIT_BYTES);
      if (bytes.byteLength < 512) throw new Error("Public-domain camera image is empty.");
      return {
        bytes,
        contentType,
        sourceUrl: finalUrl.toString(),
        etag: response.headers.get("etag"),
        lastModified: response.headers.get("last-modified"),
        contentHash: createHash("sha256").update(bytes).digest("hex"),
      };
    }
    if (!contentType.includes("html")) throw new Error("Public-domain camera did not return an approved image type.");
    const html = decodeHtml(await readBounded(response, HTML_LIMIT_BYTES));
    const candidates = candidateImageUrls(html, finalUrl);
    const pathPattern = definition.imagePathPattern ? new RegExp(definition.imagePathPattern, "i") : null;
    let next: string | null = null;
    for (const candidate of candidates) {
      try {
        const allowed = await assertAllowedPublicHttps(candidate, definition.allowedHosts);
        const imageLike = /\.(?:jpe?g|png|webp|gif)(?:\?|$)/i.test(candidate) || candidate.includes("newest");
        const pathAllowed = !pathPattern || pathPattern.test(allowed.pathname);
        if (imageLike && pathAllowed) {
          next = candidate;
          break;
        }
      } catch {
        // Ignore unapproved page assets and keep searching.
      }
    }
    if (!next) throw new Error("The official webcam page did not expose an approved current image.");
    current = next;
  }
  throw new Error("The official webcam image could not be resolved.");
}

async function checkOfficialLink(definition: LiveSourceDefinition) {
  const head = await fetchAllowed(definition.officialSourceUrl, definition, "HEAD");
  if (head.response.ok) {
    await head.response.body?.cancel();
    return { availability: "healthy" as const, embedUrl: null, message: "Official source page is available.", sourceTimestamp: null, etag: head.response.headers.get("etag"), lastModified: head.response.headers.get("last-modified"), contentHash: null };
  }
  await head.response.body?.cancel();
  const get = await fetchAllowed(definition.officialSourceUrl, definition, "GET");
  if (!get.response.ok) throw new Error(`Official source page returned HTTP ${get.response.status}.`);
  const contentType = get.response.headers.get("content-type")?.split(";", 1)[0]?.toLowerCase() ?? "";
  if (contentType && !contentType.includes("html")) throw new Error("Official source page did not return HTML.");
  await readBounded(get.response, HTML_LIMIT_BYTES);
  return { availability: "healthy" as const, embedUrl: null, message: "Official source page is available.", sourceTimestamp: null, etag: get.response.headers.get("etag"), lastModified: get.response.headers.get("last-modified"), contentHash: null };
}

export async function checkLiveSource(sourceKey: string) {
  const definition = getLiveSourceDefinition(sourceKey);
  if (!definition) throw new Error("Unknown approved live source.");
  if (definition.adapter === "official_live_link") return checkOfficialLink(definition);
  if (definition.adapter === "official_live_embed") {
    if (definition.embedVideoId) {
      const oembed = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${definition.embedVideoId}`)}&format=json`;
      const { response } = await fetchAllowed(oembed, definition);
      if (!response.ok) throw new Error(`Official YouTube player returned HTTP ${response.status}.`);
    }
    const result = await resolveOfficialEmbed(sourceKey);
    return { ...result, sourceTimestamp: null, etag: null, lastModified: null, contentHash: null };
  }
  const image = await resolveLiveImage(sourceKey);
  const parsedTimestamp = image.lastModified ? new Date(image.lastModified) : null;
  const stale = parsedTimestamp && !Number.isNaN(parsedTimestamp.getTime())
    ? Date.now() - parsedTimestamp.getTime() > definition.freshnessThresholdSeconds * 1000
    : false;
  return {
    availability: stale ? "degraded" as const : "healthy" as const,
    embedUrl: null,
    message: stale ? "The official current image appears stale." : null,
    sourceTimestamp: parsedTimestamp && !Number.isNaN(parsedTimestamp.getTime()) ? parsedTimestamp.toISOString() : null,
    etag: image.etag,
    lastModified: image.lastModified,
    contentHash: image.contentHash,
  };
}
