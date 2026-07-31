import { DeleteObjectCommand, GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BACKUP_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) throw new Error("Private export storage is not configured.");
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function client() {
  const { accountId, accessKeyId, secretAccessKey } = config();
  return new S3Client({
    region: "auto",
    endpoint: process.env.R2_ENDPOINT ?? `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function putAccountExport(key: string, body: Buffer, requestId: string) {
  const { bucket } = config();
  await client().send(new PutObjectCommand({
    Bucket: bucket,
    Key: key,
    Body: body,
    ContentType: "application/json",
    ContentEncoding: "gzip",
    ContentDisposition: `attachment; filename="jalwa-account-export-${requestId}.json.gz"`,
    CacheControl: "private, no-store",
    Metadata: { "jalwa-account-export": requestId },
  }));
}

export async function deleteAccountExport(key: string) {
  const { bucket } = config();
  await client().send(new DeleteObjectCommand({ Bucket: bucket, Key: key }));
}

export async function accountExportUrl(key: string, requestId: string) {
  const { bucket } = config();
  return getSignedUrl(client(), new GetObjectCommand({
    Bucket: bucket,
    Key: key,
    ResponseContentType: "application/json",
    ResponseContentEncoding: "gzip",
    ResponseContentDisposition: `attachment; filename="jalwa-account-export-${requestId}.json.gz"`,
    ResponseCacheControl: "private, no-store",
  }), { expiresIn: 300 });
}
