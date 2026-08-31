import { createHash } from "node:crypto";
import { lookup as dnsLookup } from "node:dns";
import { createWriteStream } from "node:fs";
import { mkdir, rm, stat } from "node:fs/promises";
import { get as httpsGet } from "node:https";
import { isIP } from "node:net";
import { dirname } from "node:path";
import { pipeline } from "node:stream/promises";
import { Transform } from "node:stream";
import { uploadSourceFile, verifyObject } from "./storage.mjs";

const DEFAULT_MAX_BYTES = 1024 * 1024 * 1024;
const DEFAULT_MAX_REDIRECTS = 3;
const ALLOWED_VIDEO_TYPES = new Set([
  "video/mp4",
  "video/quicktime",
  "video/webm",
  "video/x-matroska",
]);

const SOURCE_HOSTS = new Map([
  ["wikimedia", ["upload.wikimedia.org"]],
  ["nasa", ["images-assets.nasa.gov", "images.nasa.gov"]],
  ["smithsonian", ["ids.si.edu"]],
  ["met", ["images.metmuseum.org"]],
  ["artic", ["www.artic.edu"]],
  ["cleveland", ["openaccess-cdn.clevelandart.org"]],
  ["blender", ["download.blender.org", "media.blender.org", "studio.blender.org"]],
]);

function sourceFamily(sourceKey, provider) {
  if (sourceKey?.startsWith("WM-")) return "wikimedia";
  if (sourceKey?.startsWith("NA-")) return "nasa";
  if (sourceKey?.startsWith("SM-")) return "smithsonian";
  if (sourceKey === "MU-001") return "met";
  if (sourceKey === "MU-002") return "artic";
  if (sourceKey === "MU-003") return "cleveland";
  if (sourceKey?.startsWith("OP-")) return "blender";
  return String(provider ?? "").toLowerCase();
}

function hostAllowed(hostname, sourceKey, provider) {
  const hosts = SOURCE_HOSTS.get(sourceFamily(sourceKey, provider)) ?? [];
  const host = hostname.toLowerCase().replace(/\.$/, "");
  return hosts.some((allowed) => host === allowed || host.endsWith(`.${allowed}`));
}

function ipv4Public(address) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && (b === 0 || b === 168)) return false;
  if (a === 198 && (b === 18 || b === 19 || b === 51)) return false;
  if (a === 203 && b === 0) return false;
  return true;
}

function ipPublic(address) {
  const version = isIP(address);
  if (version === 4) return ipv4Public(address);
  if (version !== 6) return false;
  const value = address.toLowerCase();
  if (value === "::" || value === "::1") return false;
  if (value.startsWith("fc") || value.startsWith("fd") || value.startsWith("fe8") || value.startsWith("fe9") || value.startsWith("fea") || value.startsWith("feb")) return false;
  if (value.startsWith("ff") || value.startsWith("2001:db8:")) return false;
  if (value.startsWith("::ffff:")) return ipv4Public(value.slice(7));
  return true;
}

function pinnedLookup(hostname, options, callback) {
  dnsLookup(hostname, { all: true, verbatim: true }, (error, addresses) => {
    if (error) return callback(error);
    const publicAddresses = addresses.filter((entry) => ipPublic(entry.address));
    if (!publicAddresses.length || publicAddresses.length !== addresses.length) {
      return callback(new Error("Source host resolved to a private or reserved address."));
    }
    const selected = publicAddresses[0];
    if (options?.all) return callback(null, publicAddresses);
    return callback(null, selected.address, selected.family);
  });
}

function validateUrl(value, sourceKey, provider) {
  const url = new URL(value);
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) {
    throw new Error("Source download URL must use public HTTPS without credentials or a custom port.");
  }
  if (!hostAllowed(url.hostname, sourceKey, provider)) {
    throw new Error(`Source media host is not allowlisted for ${sourceKey}.`);
  }
  return url;
}

function maxRedirects() {
  const value = Number(process.env.SOURCE_DOWNLOAD_MAX_REDIRECTS ?? DEFAULT_MAX_REDIRECTS);
  return Number.isInteger(value) && value >= 0 && value <= 5 ? value : DEFAULT_MAX_REDIRECTS;
}

function request(url, sourceKey, provider, redirects = 0) {
  const safeUrl = validateUrl(url, sourceKey, provider);
  return new Promise((resolve, reject) => {
    const req = httpsGet(safeUrl, {
      lookup: pinnedLookup,
      headers: {
        "User-Agent": "JalwaAlphaIngest/1.0 rights-first",
        Accept: "video/mp4,video/webm,video/quicktime,video/x-matroska",
      },
      timeout: Number(process.env.SOURCE_DOWNLOAD_TIMEOUT_MS ?? 120000),
    }, (response) => {
      const status = response.statusCode ?? 0;
      if ([301, 302, 303, 307, 308].includes(status)) {
        response.resume();
        const location = response.headers.location;
        if (!location || redirects >= maxRedirects()) return reject(new Error("Source media redirect limit exceeded."));
        const next = new URL(location, safeUrl).toString();
        request(next, sourceKey, provider, redirects + 1).then(resolve, reject);
        return;
      }
      if (status < 200 || status >= 300) {
        response.resume();
        return reject(new Error(`Source media request returned ${status}.`));
      }
      resolve({ response, finalUrl: safeUrl.toString() });
    });
    req.once("timeout", () => req.destroy(new Error("Source media request timed out.")));
    req.once("error", reject);
  });
}

class LimitAndHash extends Transform {
  constructor(maxBytes) {
    super();
    this.maxBytes = maxBytes;
    this.sizeBytes = 0;
    this.hash = createHash("sha256");
  }
  _transform(chunk, encoding, callback) {
    this.sizeBytes += chunk.length;
    if (this.sizeBytes > this.maxBytes) return callback(new Error("Source media exceeds the automatic-download size limit."));
    this.hash.update(chunk);
    callback(null, chunk);
  }
  digest() { return this.hash.digest("hex"); }
}

async function downloadToFile({ url, sourceKey, provider, target }) {
  const { response, finalUrl } = await request(url, sourceKey, provider);
  const contentType = String(response.headers["content-type"] ?? "").split(";", 1)[0].trim().toLowerCase();
  if (!ALLOWED_VIDEO_TYPES.has(contentType)) {
    response.resume();
    throw new Error(`Source media type ${contentType || "unknown"} is not approved for automatic video intake.`);
  }
  const declared = Number(response.headers["content-length"] ?? 0);
  const maxBytes = Math.min(Number(process.env.SOURCE_DOWNLOAD_MAX_BYTES ?? DEFAULT_MAX_BYTES), 10 * 1024 * 1024 * 1024);
  if (declared && (!Number.isFinite(declared) || declared > maxBytes)) {
    response.resume();
    throw new Error("Source media exceeds the automatic-download size limit.");
  }
  await mkdir(dirname(target), { recursive: true });
  const limiter = new LimitAndHash(maxBytes);
  await pipeline(response, limiter, createWriteStream(target, { mode: 0o600 }));
  const info = await stat(target);
  if (!info.size || info.size !== limiter.sizeBytes) throw new Error("Downloaded media size verification failed.");
  return { sizeBytes: info.size, contentType, checksum: limiter.digest(), finalUrl };
}

export async function processSourceDownloadJob({ database, job }) {
  const { data: sourceItem, error: sourceError } = await database.from("source_items")
    .select("id,content_id,direct_media_url,media_type,source_account_id,source_accounts(source_key,provider)")
    .eq("id", job.source_item_id)
    .maybeSingle();
  if (sourceError) throw sourceError;
  if (!sourceItem?.content_id || !sourceItem.direct_media_url) throw new Error("Source download metadata is incomplete.");
  if (!["video", "animation"].includes(String(sourceItem.media_type ?? "").toLowerCase())) throw new Error("Only approved video sources can enter automatic intake.");

  const sourceAccount = Array.isArray(sourceItem.source_accounts) ? sourceItem.source_accounts[0] : sourceItem.source_accounts;
  if (!sourceAccount?.source_key) throw new Error("Source account metadata is unavailable.");
  const { data: asset, error: assetError } = await database.from("media_assets")
    .select("id,content_id,storage_key,status")
    .eq("id", job.media_asset_id)
    .maybeSingle();
  if (assetError) throw assetError;
  if (!asset || asset.content_id !== sourceItem.content_id) throw new Error("Source download asset mismatch.");

  const { data: allowed, error: allowedError } = await database.rpc("is_content_processing_allowed", { p_content_id: asset.content_id });
  if (allowedError) throw allowedError;
  if (!allowed) throw new Error("Source download blocked by rights, source or content state.");

  const target = `/tmp/jalwa-source-download/${job.id}/source.media`;
  try {
    const downloaded = await downloadToFile({
      url: sourceItem.direct_media_url,
      sourceKey: sourceAccount.source_key,
      provider: sourceAccount.provider,
      target,
    });
    await uploadSourceFile(target, asset.storage_key, downloaded.contentType, downloaded.sizeBytes);
    const verified = await verifyObject("incoming", asset.storage_key);
    if (verified.sizeBytes !== downloaded.sizeBytes) throw new Error("Uploaded source media size does not match the downloaded file.");
    const { error: completeError } = await database.rpc("complete_source_download_job", {
      p_job_id: job.id,
      p_size_bytes: downloaded.sizeBytes,
      p_mime_type: downloaded.contentType,
      p_checksum: downloaded.checksum,
    });
    if (completeError) throw completeError;
    return { ...downloaded, storageKey: asset.storage_key };
  } finally {
    await rm(dirname(target), { recursive: true, force: true });
  }
}
