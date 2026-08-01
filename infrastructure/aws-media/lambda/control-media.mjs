import { createHash, createHmac, timingSafeEqual } from "node:crypto";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { CloudFrontClient, CreateInvalidationCommand } from "@aws-sdk/client-cloudfront";
import { HeadObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

const s3 = new S3Client({});
const secrets = new SecretsManagerClient({});
const cloudfront = new CloudFrontClient({});
let controlSecret;

async function getControlSecret() {
  if (controlSecret) return controlSecret;
  const response = await secrets.send(new GetSecretValueCommand({ SecretId: process.env.CONTROL_SECRET_ARN }));
  const raw = response.SecretString ?? Buffer.from(response.SecretBinary ?? []).toString("utf8");
  try {
    const parsed = JSON.parse(raw);
    controlSecret = parsed.secret;
  } catch {
    controlSecret = raw;
  }
  if (!controlSecret || controlSecret.length < 32) throw new Error("Media control secret must contain at least 32 characters.");
  return controlSecret;
}

function response(statusCode, body) {
  return {
    statusCode,
    headers: { "content-type": "application/json", "cache-control": "no-store" },
    body: JSON.stringify(body),
  };
}

function safeEqual(left, right) {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function authenticate(event, body) {
  const timestamp = event.headers?.["x-jalwa-timestamp"] ?? event.headers?.["X-Jalwa-Timestamp"];
  const signature = event.headers?.["x-jalwa-signature"] ?? event.headers?.["X-Jalwa-Signature"];
  const numericTimestamp = Number(timestamp);
  if (!timestamp || !signature || !Number.isFinite(numericTimestamp)) return null;
  if (Math.abs(Date.now() - numericTimestamp) > 300_000) return null;
  const secret = await getControlSecret();
  const expected = createHmac("sha256", secret).update(`${timestamp}\n${body}`).digest("hex");
  return safeEqual(expected, signature) ? timestamp : null;
}


function awsEncode(value) {
  return encodeURIComponent(value).replace(/[!'()*]/g, (character) => `%${character.charCodeAt(0).toString(16).toUpperCase()}`);
}

function signingKey(secret, date, region) {
  const dateKey = createHmac("sha256", `AWS4${secret}`).update(date).digest();
  const regionKey = createHmac("sha256", dateKey).update(region).digest();
  const serviceKey = createHmac("sha256", regionKey).update("s3").digest();
  return createHmac("sha256", serviceKey).update("aws4_request").digest();
}

function presignedPutUrl(bucket, key, expiresIn = 900) {
  const accessKey = process.env.AWS_ACCESS_KEY_ID;
  const secretKey = process.env.AWS_SECRET_ACCESS_KEY;
  const sessionToken = process.env.AWS_SESSION_TOKEN;
  const region = process.env.AWS_REGION;
  if (!accessKey || !secretKey || !sessionToken || !region) throw new Error("Lambda AWS signing credentials are unavailable.");
  const now = new Date();
  const amzDate = now.toISOString().replace(/[:-]|\.\d{3}/g, "");
  const date = amzDate.slice(0, 8);
  const scope = `${date}/${region}/s3/aws4_request`;
  const host = `${bucket}.s3.${region}.amazonaws.com`;
  const path = `/${key.split("/").map(awsEncode).join("/")}`;
  const query = new URLSearchParams({
    "X-Amz-Algorithm": "AWS4-HMAC-SHA256",
    "X-Amz-Credential": `${accessKey}/${scope}`,
    "X-Amz-Date": amzDate,
    "X-Amz-Expires": String(expiresIn),
    "X-Amz-Security-Token": sessionToken,
    "X-Amz-SignedHeaders": "host",
  });
  const canonicalQuery = [...query.entries()]
    .map(([name, value]) => [awsEncode(name), awsEncode(value)])
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}=${value}`)
    .join("&");
  const canonicalRequest = ["PUT", path, canonicalQuery, `host:${host}\n`, "host", "UNSIGNED-PAYLOAD"].join("\n");
  const stringToSign = [
    "AWS4-HMAC-SHA256",
    amzDate,
    scope,
    createHash("sha256").update(canonicalRequest).digest("hex"),
  ].join("\n");
  const signature = createHmac("sha256", signingKey(secretKey, date, region)).update(stringToSign).digest("hex");
  return `https://${host}${path}?${canonicalQuery}&X-Amz-Signature=${signature}`;
}

function sourceKeyAllowed(key) {
  return /^incoming\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/source\.[a-z0-9]{1,8}$/i.test(key) && !key.includes("..");
}

function processedKeyAllowed(key) {
  return /^processed\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/[A-Za-z0-9_./-]+$/.test(key) && !key.includes("..");
}

function markerAllowed(key) {
  return /^jobs\/[0-9a-f-]{36}\.json$/i.test(key);
}

function processedPrefixAllowed(prefix) {
  return /^processed\/[0-9a-f-]{36}\/[0-9a-f-]{36}\/$/i.test(prefix) && !prefix.includes("..");
}

export async function handler(event) {
  const body = event.body ?? "";
  const requestTimestamp = await authenticate(event, body);
  if (!requestTimestamp) return response(401, { error: "Unauthorized." });
  let input;
  try { input = JSON.parse(body); } catch { return response(400, { error: "Invalid JSON." }); }

  if (input.action === "create-upload") {
    if (!sourceKeyAllowed(input.key)) return response(400, { error: "Invalid incoming key." });
    const sizeBytes = Number(input.sizeBytes);
    if (!Number.isInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > Number(process.env.MAX_UPLOAD_BYTES ?? 10_737_418_240)) {
      return response(400, { error: "Invalid upload size." });
    }
    if (!/^video\/(mp4|quicktime|webm|x-matroska)$/i.test(input.contentType ?? "")) {
      return response(400, { error: "Unsupported upload content type." });
    }
    const uploadUrl = presignedPutUrl(process.env.INCOMING_BUCKET, input.key, 900);
    return response(200, { uploadUrl, expiresIn: 900 });
  }

  if (input.action === "verify-object") {
    const processed = input.kind === "processed";
    const allowed = processed ? processedKeyAllowed(input.key) : sourceKeyAllowed(input.key);
    if (!allowed) return response(400, { error: "Invalid media key." });
    const result = await s3.send(new HeadObjectCommand({
      Bucket: processed ? process.env.PROCESSED_BUCKET : process.env.INCOMING_BUCKET,
      Key: input.key,
    }));
    return response(200, { sizeBytes: Number(result.ContentLength ?? 0), contentType: result.ContentType ?? null });
  }

  if (input.action === "enqueue") {
    if (!markerAllowed(input.key)) return response(400, { error: "Invalid marker key." });
    const marker = input.marker;
    if (!marker || marker.jobId !== input.key.slice(5, -5)) return response(400, { error: "Marker job mismatch." });
    const payload = Buffer.from(JSON.stringify(marker));
    await s3.send(new PutObjectCommand({
      Bucket: process.env.INCOMING_BUCKET,
      Key: input.key,
      Body: payload,
      ContentLength: payload.length,
      ContentType: "application/json",
      CacheControl: "no-store",
      ServerSideEncryption: "aws:kms",
      SSEKMSKeyId: process.env.KMS_KEY_ARN,
    }));
    return response(202, { queued: true, key: input.key });
  }

  if (input.action === "invalidate") {
    const rawPrefixes = Array.isArray(input.prefixes) ? input.prefixes : [input.prefix];
    const prefixes = [...new Set(rawPrefixes.filter((prefix) => typeof prefix === "string"))];
    if (!prefixes.length || prefixes.length > 1000 || prefixes.some((prefix) => !processedPrefixAllowed(prefix))) {
      return response(400, { error: "Invalid processed-media prefixes." });
    }
    if (!process.env.DISTRIBUTION_ID) return response(503, { error: "CloudFront distribution is not configured." });
    const items = prefixes.map((prefix) => `/${prefix}*`);
    const result = await cloudfront.send(new CreateInvalidationCommand({
      DistributionId: process.env.DISTRIBUTION_ID,
      InvalidationBatch: {
        CallerReference: `${requestTimestamp}-${createHmac("sha256", await getControlSecret()).update(items.join("\n")).digest("hex").slice(0, 24)}`,
        Paths: { Quantity: items.length, Items: items },
      },
    }));
    return response(202, { invalidationId: result.Invalidation?.Id ?? null, prefixes });
  }

  return response(400, { error: "Unsupported action." });
}
