import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

const secrets = new SecretsManagerClient({});
let callbackSecret;

async function getCallbackSecret() {
  if (callbackSecret) return callbackSecret;
  const response = await secrets.send(new GetSecretValueCommand({ SecretId: process.env.APPLICATION_CALLBACK_SECRET_ARN }));
  const raw = response.SecretString ?? Buffer.from(response.SecretBinary ?? []).toString("utf8");
  const parsed = JSON.parse(raw);
  if (!parsed.url || !parsed.secret) throw new Error("Application callback secret requires url and secret.");
  callbackSecret = parsed;
  return parsed;
}

async function callback(action, body) {
  const target = await getCallbackSecret();
  const response = await fetch(target.url, {
    method: "POST",
    headers: { "content-type": "application/json", "x-jalwa-media-callback-secret": target.secret },
    body: JSON.stringify({ action, ...body }),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`Jalwa media callback failed: ${response.status} ${await response.text()}`);
}

function objectKey(s3Uri) {
  if (!s3Uri?.startsWith("s3://")) return null;
  const withoutScheme = s3Uri.slice(5);
  const slash = withoutScheme.indexOf("/");
  return slash < 0 ? null : withoutScheme.slice(slash + 1);
}

function outputPaths(detail) {
  const paths = [];
  for (const group of detail.outputGroupDetails ?? []) {
    paths.push(...(group.playlistFilePaths ?? []));
    for (const output of group.outputDetails ?? []) paths.push(...(output.outputFilePaths ?? []));
  }
  return paths;
}

export async function handler(event) {
  const detail = event.detail ?? {};
  const metadata = detail.userMetadata ?? {};
  const jobId = metadata.jalwaJobId;
  const jobType = metadata.jalwaJobType;
  if (!jobId || !jobType) {
    console.log(JSON.stringify({ event: "mediaconvert_event_ignored", reason: "missing_jalwa_metadata", providerJobId: detail.jobId }));
    return;
  }

  const success = detail.status === "COMPLETE";
  const paths = outputPaths(detail);
  const expectedExtension = jobType === "hls" ? ".m3u8" : ".mp4";
  const mediaPath = success
    ? objectKey(paths.find((path) => path.endsWith(expectedExtension)))
    : null;
  if (success && !mediaPath) throw new Error(`Completed MediaConvert job has no ${expectedExtension} output.`);

  await callback("completed", {
    jobId, success, mediaPath, format: jobType === "hls" ? "hls" : "mp4",
    providerJobId: detail.jobId ?? "unknown",
    errorMessage: success ? null : detail.errorMessage ?? detail.errorCode ?? "MediaConvert job failed",
  });
  console.log(JSON.stringify({ event: "mediaconvert_completed", jobId, providerJobId: detail.jobId, success, mediaPath }));
}
