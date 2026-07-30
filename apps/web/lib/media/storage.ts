import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

function config() {
  const accountId = process.env.R2_ACCOUNT_ID;
  const accessKeyId = process.env.R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.R2_SECRET_ACCESS_KEY;
  const bucket = process.env.R2_BUCKET;
  if (!accountId || !accessKeyId || !secretAccessKey || !bucket) throw new Error("R2 is not configured");
  return { accountId, accessKeyId, secretAccessKey, bucket };
}

function client() {
  const { accountId, accessKeyId, secretAccessKey } = config();
  return new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId, secretAccessKey },
  });
}

export async function createUploadUrl(input: { key: string; contentType: string; sizeBytes: number }) {
  const { bucket } = config();
  return getSignedUrl(
    client(),
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

export async function verifyUploadedObject(key: string) {
  const { bucket } = config();
  const response = await client().send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  return { sizeBytes: Number(response.ContentLength ?? 0), contentType: response.ContentType ?? null };
}
