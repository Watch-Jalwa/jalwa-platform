import { createHmac } from "node:crypto";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type BucketKind = "incoming" | "processed";

function mediaBackend() {
  return (process.env.MEDIA_BACKEND ?? "r2").trim().toLowerCase();
}

async function mediaControlRequest<T>(payload: Record<string, unknown>): Promise<T> {
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
    cache: "no-store",
    signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`AWS media control request failed: ${response.status} ${await response.text()}`);
  return response.json() as Promise<T>;
}

function r2Config(kind: BucketKind) {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = kind === "incoming"
    ? process.env.R2_INCOMING_BUCKET ?? process.env.R2_BUCKET
    : process.env.R2_PROCESSED_BUCKET ?? process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) throw new Error(`R2 ${kind} storage is not configured`);
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function r2Client(kind: BucketKind) {
  const { accountId, accessKeyId, secretAccessKey } = r2Config(kind);
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT ?? `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function createUploadUrl(input: { key: string; contentType: string; sizeBytes: number }) {
  if (mediaBackend() === "aws") {
    const result = await mediaControlRequest<{ uploadUrl: string }>({
      action: "create-upload",
      key: input.key,
      contentType: input.contentType,
      sizeBytes: input.sizeBytes,
    });
    return result.uploadUrl;
  }
  const { bucket } = r2Config("incoming");
  return getSignedUrl(
    r2Client("incoming"),
    new PutObjectCommand({
      Bucket: bucket,
      Key: input.key,
      ContentType: input.contentType,
      ContentLength: input.sizeBytes,
      Metadata: { "jalwa-upload": "studio" },
    }),
    { expiresIn: 900 },
  );
}

async function headObject(kind: BucketKind, key: string) {
  if (mediaBackend() === "aws") {
    return mediaControlRequest<{ sizeBytes: number; contentType: string | null }>({
      action: "verify-object",
      kind,
      key,
    });
  }
  const { bucket } = r2Config(kind);
  const response = await r2Client(kind).send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  return { sizeBytes: Number(response.ContentLength ?? 0), contentType: response.ContentType ?? null };
}

export function verifyUploadedObject(key: string) {
  return headObject("incoming", key);
}

export function verifyProcessedObject(key: string) {
  return headObject("processed", key);
}

export async function invalidateProcessedMedia(entries: { contentId: string; assetId: string }[]) {
  if (mediaBackend() !== "aws" || !entries.length) return null;
  const uuid = /^[0-9a-f-]{36}$/i;
  const prefixes = entries.map(({ contentId, assetId }) => {
    if (!uuid.test(contentId) || !uuid.test(assetId)) throw new Error("Invalid media invalidation identifiers.");
    return `processed/${contentId}/${assetId}/`;
  });
  return mediaControlRequest<{ invalidationId: string | null }>({
    action: "invalidate",
    prefixes,
  });
}
