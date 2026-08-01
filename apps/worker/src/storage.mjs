import { createReadStream, createWriteStream } from "node:fs";
import { createHmac } from "node:crypto";
import { mkdir, readdir, stat } from "node:fs/promises";
import { dirname, relative } from "node:path";
import { pipeline } from "node:stream/promises";
import { GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export function mediaBackend() {
  return (process.env.MEDIA_BACKEND ?? "r2").trim().toLowerCase();
}

export function storageConfigured() {
  if (mediaBackend() === "aws") {
    const transcodeBackend = (process.env.TRANSCODE_BACKEND ?? "mediaconvert").trim().toLowerCase();
    if (transcodeBackend === "mediaconvert") {
      return Boolean(process.env.AWS_MEDIA_CONTROL_URL && process.env.AWS_MEDIA_CONTROL_SECRET);
    }
    return Boolean(
      process.env.AWS_REGION
      && process.env.AWS_MEDIA_INCOMING_BUCKET
      && process.env.AWS_MEDIA_PROCESSED_BUCKET
    );
  }
  return Boolean(
    process.env.R2_ACCOUNT_ID
    && process.env.R2_ACCESS_KEY_ID
    && process.env.R2_SECRET_ACCESS_KEY
    && (process.env.R2_INCOMING_BUCKET || process.env.R2_BUCKET)
    && (process.env.R2_PROCESSED_BUCKET || process.env.R2_BUCKET)
  );
}

function bucket(kind) {
  if (mediaBackend() === "aws") {
    const value = kind === "incoming"
      ? process.env.AWS_MEDIA_INCOMING_BUCKET
      : process.env.AWS_MEDIA_PROCESSED_BUCKET;
    if (!value) throw new Error(`AWS ${kind} media bucket is not configured.`);
    return value;
  }
  const value = kind === "incoming"
    ? process.env.R2_INCOMING_BUCKET ?? process.env.R2_BUCKET
    : process.env.R2_PROCESSED_BUCKET ?? process.env.R2_BUCKET;
  if (!value) throw new Error(`R2 ${kind} media bucket is not configured.`);
  return value;
}

function storageClient() {
  if (mediaBackend() === "aws") {
    if (!process.env.AWS_REGION) throw new Error("AWS region is not configured.");
    return new S3Client({ region: process.env.AWS_REGION });
  }
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) {
    throw new Error("R2 credentials are not configured.");
  }
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT ?? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    },
  });
}

export async function downloadObject(key, target, kind = "incoming") {
  const response = await storageClient().send(new GetObjectCommand({ Bucket: bucket(kind), Key: key }));
  if (!response.Body) throw new Error("Media object has no body.");
  await mkdir(dirname(target), { recursive: true });
  await pipeline(response.Body, createWriteStream(target));
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) paths.push(...await walk(path));
    else paths.push(path);
  }
  return paths;
}

function contentType(path) {
  if (path.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (path.endsWith(".mpd")) return "application/dash+xml";
  if (path.endsWith(".m4s")) return "video/iso.segment";
  if (path.endsWith(".ts")) return "video/mp2t";
  if (path.endsWith(".mp4")) return "video/mp4";
  if (path.endsWith(".vtt")) return "text/vtt";
  if (path.endsWith(".webp")) return "image/webp";
  if (path.endsWith(".jpg") || path.endsWith(".jpeg")) return "image/jpeg";
  if (path.endsWith(".png")) return "image/png";
  return "application/octet-stream";
}

function cacheControl(path) {
  return path.endsWith(".m3u8")
    ? "private, no-store"
    : "public, max-age=31536000, immutable";
}

export async function uploadDirectory(directory, prefix) {
  const uploaded = [];
  const client = storageClient();
  for (const path of await walk(directory)) {
    const key = `${prefix}${relative(directory, path).replaceAll("\\", "/")}`;
    const info = await stat(path);
    await client.send(new PutObjectCommand({
      Bucket: bucket("processed"),
      Key: key,
      Body: createReadStream(path),
      ContentLength: info.size,
      ContentType: contentType(path),
      CacheControl: cacheControl(path),
      ServerSideEncryption: mediaBackend() === "aws" ? "aws:kms" : undefined,
      SSEKMSKeyId: mediaBackend() === "aws" ? process.env.AWS_MEDIA_KMS_KEY_ID : undefined,
    }));
    uploaded.push(key);
  }
  return uploaded;
}

async function mediaControlRequest(payload) {
  const url = process.env.AWS_MEDIA_CONTROL_URL;
  const secret = process.env.AWS_MEDIA_CONTROL_SECRET;
  if (!url || !secret) throw new Error("AWS media control endpoint is not configured.");
  const body = JSON.stringify(payload);
  const timestamp = String(Date.now());
  const signature = createHmac("sha256", secret).update(`${timestamp}\n${body}`).digest("hex");
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Jalwa-Timestamp": timestamp,
      "X-Jalwa-Signature": signature,
    },
    body,
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`AWS media control request failed: ${response.status} ${await response.text()}`);
  return response.json();
}

export async function uploadSourceFile(path, key, contentType, sizeBytes) {
  if (mediaBackend() === "aws" && (process.env.TRANSCODE_BACKEND ?? "mediaconvert").toLowerCase() === "mediaconvert") {
    const { uploadUrl } = await mediaControlRequest({
      action: "create-upload",
      key,
      contentType,
      sizeBytes,
    });
    const response = await fetch(uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": contentType,
        "Content-Length": String(sizeBytes),
      },
      body: createReadStream(path),
      duplex: "half",
      signal: AbortSignal.timeout(Number(process.env.SOURCE_UPLOAD_TIMEOUT_MS ?? 900000)),
    });
    if (!response.ok) throw new Error(`AWS source upload failed: ${response.status} ${await response.text()}`);
    return key;
  }

  await storageClient().send(new PutObjectCommand({
    Bucket: bucket("incoming"),
    Key: key,
    Body: createReadStream(path),
    ContentLength: sizeBytes,
    ContentType: contentType,
    CacheControl: "no-store",
    ServerSideEncryption: mediaBackend() === "aws" ? "aws:kms" : undefined,
    SSEKMSKeyId: mediaBackend() === "aws" ? process.env.AWS_MEDIA_KMS_KEY_ID : undefined,
    Metadata: { "jalwa-ingest": "rights-first-source" },
  }));
  return key;
}

export async function verifyObject(kind, key) {
  if (mediaBackend() === "aws" && (process.env.TRANSCODE_BACKEND ?? "mediaconvert").toLowerCase() === "mediaconvert") {
    return mediaControlRequest({ action: "verify-object", kind, key });
  }
  const response = await storageClient().send(new HeadObjectCommand({ Bucket: bucket(kind), Key: key }));
  return { sizeBytes: Number(response.ContentLength ?? 0), contentType: response.ContentType ?? null };
}

export async function uploadJsonMarker(key, payload) {
  if (mediaBackend() === "aws") {
    await mediaControlRequest({ action: "enqueue", key, marker: payload });
    return key;
  }
  const body = Buffer.from(JSON.stringify(payload));
  await storageClient().send(new PutObjectCommand({
    Bucket: bucket("incoming"),
    Key: key,
    Body: body,
    ContentLength: body.length,
    ContentType: "application/json",
    CacheControl: "no-store",
  }));
  return key;
}
