import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { CreateJobCommand, MediaConvertClient } from "@aws-sdk/client-mediaconvert";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";

const s3 = new S3Client({});
const mediaConvert = new MediaConvertClient({});
const secrets = new SecretsManagerClient({});
let supabaseSecret;

async function streamText(body) {
  if (!body) throw new Error("S3 marker has no body.");
  return body.transformToString();
}

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

function videoDescription(width, height, maxBitrate) {
  return {
    Width: width,
    Height: height,
    ScalingBehavior: "DEFAULT",
    Sharpness: 50,
    AntiAlias: "ENABLED",
    CodecSettings: {
      Codec: "H_264",
      H264Settings: {
        RateControlMode: "QVBR",
        MaxBitrate: maxBitrate,
        QvbrSettings: { QvbrQualityLevel: 7 },
        CodecProfile: height >= 720 ? "HIGH" : "MAIN",
        CodecLevel: "AUTO",
        GopSize: 2,
        GopSizeUnits: "SECONDS",
        SceneChangeDetect: "ENABLED",
        FramerateControl: "INITIALIZE_FROM_SOURCE",
        ParControl: "INITIALIZE_FROM_SOURCE",
        NumberBFramesBetweenReferenceFrames: 2,
      },
    },
  };
}

function audioDescription() {
  return {
    AudioSourceName: "Audio Selector 1",
    CodecSettings: {
      Codec: "AAC",
      AacSettings: {
        Bitrate: 128000,
        CodingMode: "CODING_MODE_2_0",
        SampleRate: 48000,
        Specification: "MPEG4",
        RawFormat: "NONE",
        AudioDescriptionBroadcasterMix: "NORMAL",
      },
    },
  };
}

function hlsSettings(marker) {
  const base = `s3://${process.env.PROCESSED_BUCKET}/processed/${marker.contentId}/${marker.assetId}/master`;
  return {
    OutputGroups: [{
      Name: "Jalwa adaptive HLS",
      OutputGroupSettings: {
        Type: "HLS_GROUP_SETTINGS",
        HlsGroupSettings: {
          Destination: base,
          SegmentLength: 6,
          MinSegmentLength: 0,
          ManifestDurationFormat: "INTEGER",
          OutputSelection: "MANIFESTS_AND_SEGMENTS",
          SegmentControl: "SEGMENTED_FILES",
          DirectoryStructure: "SINGLE_DIRECTORY",
          StreamInfResolution: "INCLUDE",
          ClientCache: "ENABLED",
          CaptionLanguageSetting: "OMIT",
        },
      },
      Outputs: [
        { NameModifier: "_360p", ContainerSettings: { Container: "M3U8" }, VideoDescription: videoDescription(640, 360, 900000), AudioDescriptions: [audioDescription()] },
        { NameModifier: "_480p", ContainerSettings: { Container: "M3U8" }, VideoDescription: videoDescription(854, 480, 1600000), AudioDescriptions: [audioDescription()] },
        { NameModifier: "_720p", ContainerSettings: { Container: "M3U8" }, VideoDescription: videoDescription(1280, 720, 3000000), AudioDescriptions: [audioDescription()] },
      ],
    }],
  };
}

function shortSettings(marker) {
  const base = `s3://${process.env.PROCESSED_BUCKET}/processed/${marker.contentId}/${marker.assetId}/short-720`;
  return {
    OutputGroups: [{
      Name: "Jalwa portrait MP4",
      OutputGroupSettings: {
        Type: "FILE_GROUP_SETTINGS",
        FileGroupSettings: { Destination: base },
      },
      Outputs: [{
        ContainerSettings: { Container: "MP4", Mp4Settings: { MoovPlacement: "PROGRESSIVE_DOWNLOAD" } },
        VideoDescription: videoDescription(720, 1280, 2800000),
        AudioDescriptions: [audioDescription()],
      }],
    }],
  };
}

function parseS3Events(record) {
  const payload = JSON.parse(record.body);
  return payload.Records ?? [];
}

async function submitMarker(bucket, key) {
  if (!key.startsWith("jobs/") || !key.endsWith(".json")) return;
  const markerResponse = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const marker = JSON.parse(await streamText(markerResponse.Body));
  for (const field of ["jobId", "jobType", "assetId", "contentId", "sourceKey"]) {
    if (!marker[field]) throw new Error(`Media marker is missing ${field}.`);
  }
  if (!["hls", "short_mp4"].includes(marker.jobType)) throw new Error("Unsupported media job type.");

  const response = await mediaConvert.send(new CreateJobCommand({
    ClientRequestToken: marker.jobId,
    Queue: process.env.MEDIACONVERT_QUEUE_ARN,
    Role: process.env.MEDIACONVERT_ROLE_ARN,
    UserMetadata: {
      jalwaJobId: marker.jobId,
      jalwaAssetId: marker.assetId,
      jalwaContentId: marker.contentId,
      jalwaJobType: marker.jobType,
    },
    Settings: {
      TimecodeConfig: { Source: "ZEROBASED" },
      Inputs: [{
        FileInput: `s3://${process.env.INCOMING_BUCKET}/${marker.sourceKey}`,
        AudioSelectors: { "Audio Selector 1": { DefaultSelection: "DEFAULT" } },
        VideoSelector: {},
      }],
      ...(marker.jobType === "short_mp4" ? shortSettings(marker) : hlsSettings(marker)),
    },
    StatusUpdateInterval: "SECONDS_60",
    Priority: 0,
  }));

  if (!response.Job?.Id) throw new Error("MediaConvert did not return a job ID.");
  await rpc("mark_external_media_job_submitted", {
    p_job_id: marker.jobId,
    p_provider_job_id: response.Job.Id,
  });
  console.log(JSON.stringify({ event: "mediaconvert_submitted", jobId: marker.jobId, providerJobId: response.Job.Id }));
}

export async function handler(event) {
  for (const record of event.Records ?? []) {
    for (const s3Event of parseS3Events(record)) {
      const bucket = s3Event.s3?.bucket?.name;
      const key = decodeURIComponent((s3Event.s3?.object?.key ?? "").replaceAll("+", " "));
      if (!bucket || !key) throw new Error("Invalid S3 event payload.");
      await submitMarker(bucket, key);
    }
  }
  return { batchItemFailures: [] };
}
