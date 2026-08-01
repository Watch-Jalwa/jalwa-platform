import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

const secrets = new SecretsManagerClient({});
let supabaseSecret;

async function getSupabaseSecret() {
  if (supabaseSecret) return supabaseSecret;
  const response = await secrets.send(new GetSecretValueCommand({ SecretId: process.env.SUPABASE_SECRET_ARN }));
  const raw = response.SecretString ?? Buffer.from(response.SecretBinary ?? []).toString("utf8");
  const parsed = JSON.parse(raw);
  if (!parsed.url || !parsed.serviceRoleKey) throw new Error("Supabase secret requires url and serviceRoleKey.");
  supabaseSecret = parsed;
  return parsed;
}

async function rpc(name, body) {
  const secret = await getSupabaseSecret();
  const response = await fetch(`${secret.url.replace(/\/$/, "")}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: {
      apikey: secret.serviceRoleKey,
      Authorization: `Bearer ${secret.serviceRoleKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) throw new Error(`${name} failed: ${response.status} ${await response.text()}`);
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

  await rpc("complete_external_media_job", {
    p_job_id: jobId,
    p_success: success,
    p_media_path: mediaPath,
    p_format: jobType === "hls" ? "hls" : "mp4",
    p_provider_job_id: detail.jobId ?? "unknown",
    p_error_message: success ? null : detail.errorMessage ?? detail.errorCode ?? "MediaConvert job failed",
  });
  console.log(JSON.stringify({ event: "mediaconvert_completed", jobId, providerJobId: detail.jobId, success, mediaPath }));
}
