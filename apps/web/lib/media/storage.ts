import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

type BucketKind = "incoming" | "processed";

function config(kind: BucketKind) {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = kind === "incoming"
    ? process.env.R2_INCOMING_BUCKET ?? process.env.R2_BUCKET
    : process.env.R2_PROCESSED_BUCKET ?? process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) throw new Error(`R2 ${kind} storage is not configured`);
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function client(kind: BucketKind) {
  const { accountId, accessKeyId, secretAccessKey } = config(kind);
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT ?? `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function createUploadUrl(input: { key: string; contentType: string; sizeBytes: number }) {
  const { bucket } = config("incoming");
  return getSignedUrl(
    client("incoming"),
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
  const { bucket } = config(kind);
  const response = await client(kind).send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  return { sizeBytes: Number(response.ContentLength ?? 0), contentType: response.ContentType ?? null };
}

export function verifyUploadedObject(key: string) {
  return headObject("incoming", key);
}

export function verifyProcessedObject(key: string) {
  return headObject("processed", key);
}
