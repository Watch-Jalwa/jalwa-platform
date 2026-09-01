import { mkdir, rm } from "node:fs/promises";
import { basename, join } from "node:path";
import { spawn } from "node:child_process";
import { downloadObject, mediaBackend, uploadDirectory, uploadJsonMarker } from "./storage.mjs";

const LOCAL_PROTOCOLS = "file,pipe,crypto,data";
const DEFAULT_PROCESS_TIMEOUT_MS = 2 * 60 * 60 * 1000;

function inputArgs(input) {
  return ["-nostdin", "-protocol_whitelist", LOCAL_PROTOCOLS, "-i", input];
}

export function buildShortArgs(input, output) {
  return [
    "-y",
    ...inputArgs(input),
    "-vf",
    "scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2",
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-movflags",
    "+faststart",
    output,
  ];
}

export function buildThumbnailArgs(input, output) {
  return [
    "-y",
    ...inputArgs(input),
    "-vf",
    "thumbnail=30,scale=640:-2",
    "-frames:v",
    "1",
    "-q:v",
    "3",
    output,
  ];
}

export function buildHlsArgs(input, outputDir, hasAudio = true) {
  const maps = [];
  for (const video of ["[v1out]", "[v2out]", "[v3out]"]) {
    maps.push("-map", video);
    if (hasAudio) maps.push("-map", "0:a?");
  }
  const variantMap = hasAudio
    ? "v:0,a:0,name:360p v:1,a:1,name:480p v:2,a:2,name:720p"
    : "v:0,name:360p v:1,name:480p v:2,name:720p";

  return [
    "-y",
    ...inputArgs(input),
    "-filter_complex",
    "[0:v]split=3[v1][v2][v3];[v1]scale=-2:360[v1out];[v2]scale=-2:480[v2out];[v3]scale=-2:720[v3out]",
    ...maps,
    "-c:v",
    "libx264",
    "-preset",
    "veryfast",
    "-crf",
    "23",
    "-c:a",
    "aac",
    "-b:a",
    "128k",
    "-f",
    "hls",
    "-hls_time",
    "6",
    "-hls_playlist_type",
    "vod",
    "-hls_flags",
    "independent_segments",
    "-master_pl_name",
    "master.m3u8",
    "-var_stream_map",
    variantMap,
    "-hls_segment_filename",
    join(outputDir, "%v", "segment-%05d.ts"),
    join(outputDir, "%v", "index.m3u8"),
  ];
}

function processTimeout() {
  const configured = Number(process.env.MEDIA_PROCESS_TIMEOUT_MS ?? DEFAULT_PROCESS_TIMEOUT_MS);
  return Number.isFinite(configured) && configured >= 60_000 ? configured : DEFAULT_PROCESS_TIMEOUT_MS;
}

export function run(command, args, timeoutMs = processTimeout()) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, HOME: "/tmp" },
    });
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`${basename(command)} exceeded ${Math.round(timeoutMs / 1000)} seconds`));
    }, timeoutMs);
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      code === 0
        ? resolve()
        : reject(new Error(`${basename(command)} exited ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

export function capture(command, args, timeoutMs = 60_000) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, HOME: "/tmp" },
    });
    let stdout = "";
    let stderr = "";
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      child.kill("SIGKILL");
      reject(new Error(`${basename(command)} probe timed out`));
    }, timeoutMs);
    child.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    child.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    child.once("error", (error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(error);
    });
    child.once("exit", (code) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      code === 0
        ? resolve(stdout.trim())
        : reject(new Error(`${basename(command)} exited ${code}: ${stderr.slice(-2000)}`));
    });
  });
}

function ffprobeArgs(input, entries, format = "json") {
  return [
    "-v",
    "error",
    "-protocol_whitelist",
    LOCAL_PROTOCOLS,
    "-show_entries",
    entries,
    "-of",
    format,
    input,
  ];
}

export async function probeMedia(input) {
  const raw = await capture(
    process.env.FFPROBE_PATH ?? "ffprobe",
    ffprobeArgs(input, "format=duration,format_name:stream=codec_type,codec_name,width,height"),
  );
  const parsed = JSON.parse(raw || "{}");
  const result = parsed && typeof parsed === "object" ? parsed : {};
  const duration = Number(result.format?.duration ?? 0);
  const streams = Array.isArray(result.streams) ? result.streams : [];
  if (!streams.some((stream) => stream?.codec_type === "video")) throw new Error("Uploaded media contains no video stream.");
  if (streams.length > 32) throw new Error("Uploaded media contains too many streams.");
  if (Number.isFinite(duration) && duration > Number(process.env.MEDIA_MAX_DURATION_SECONDS ?? 43_200)) {
    throw new Error("Uploaded media exceeds the maximum duration.");
  }
  return {
    durationSeconds: Number.isFinite(duration) ? duration : null,
    streamCount: streams.length,
  };
}

export async function hasAudioStream(input) {
  const result = await capture(process.env.FFPROBE_PATH ?? "ffprobe", [
    "-v",
    "error",
    "-protocol_whitelist",
    LOCAL_PROTOCOLS,
    "-select_streams",
    "a:0",
    "-show_entries",
    "stream=index",
    "-of",
    "csv=p=0",
    input,
  ]);
  return Boolean(result);
}

async function assertJobStillAllowed(database, jobId, contentId) {
  const [{ data: jobState, error: jobError }, { data: allowed, error: allowedError }] = await Promise.all([
    database.from("media_jobs").select("cancel_requested,cancellation_reason").eq("id", jobId).single(),
    database.rpc("is_content_processing_allowed", { p_content_id: contentId }),
  ]);
  if (jobError) throw jobError;
  if (allowedError) throw allowedError;
  if (jobState?.cancel_requested) {
    throw new Error(jobState.cancellation_reason || "Media processing was cancelled.");
  }
  if (!allowed) throw new Error("Media processing is blocked by rights, source or content state.");
}

function transcodeBackend() {
  return (process.env.TRANSCODE_BACKEND ?? "ffmpeg").trim().toLowerCase();
}

async function dispatchMediaConvertJob({ database, job, asset }) {
  if (mediaBackend() !== "aws") throw new Error("MediaConvert requires MEDIA_BACKEND=aws.");
  await assertJobStillAllowed(database, job.id, asset.content_id);
  const markerKey = `jobs/${job.id}.json`;
  const { error } = await database.from("media_jobs").update({
    status: "processing",
    locked_at: null,
    locked_by: null,
    error_message: null,
    output: { provider: "mediaconvert", markerKey, state: "dispatching" },
  }).eq("id", job.id);
  if (error) throw error;
  await uploadJsonMarker(markerKey, {
    schemaVersion: 1,
    jobId: job.id,
    jobType: job.job_type,
    assetId: asset.id,
    contentId: asset.content_id,
    sourceKey: asset.storage_key,
    requestedAt: new Date().toISOString(),
  });
  return { provider: "mediaconvert", deferred: true, markerKey };
}

export async function processMediaJob({ database, job }) {
  const { data: asset, error } = await database.from("media_assets")
    .select("id,content_id,storage_key,metadata")
    .eq("id", job.media_asset_id)
    .single();
  if (error || !asset) throw error ?? new Error("Source asset missing");

  if (transcodeBackend() === "mediaconvert") {
    return dispatchMediaConvertJob({ database, job, asset });
  }
  if (transcodeBackend() !== "ffmpeg") throw new Error("Unsupported transcode backend.");

  const root = join(process.env.MEDIA_TEMP_DIR ?? "/tmp/jalwa-media", job.id);
  const source = join(root, "source");
  const output = join(root, "output");
  await mkdir(output, { recursive: true });

  try {
    await assertJobStillAllowed(database, job.id, asset.content_id);
    await downloadObject(asset.storage_key, source, "incoming");
    const probe = await probeMedia(source);
    const hasAudio = await hasAudioStream(source);
    const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
    const prefix = `processed/${asset.content_id}/${asset.id}/`;
    const thumbnailPath = `${prefix}thumbnail.jpg`;
    let format;
    let mediaPath;

    await run(ffmpeg, buildThumbnailArgs(source, join(output, "thumbnail.jpg")));
    await assertJobStillAllowed(database, job.id, asset.content_id);

    if (job.job_type === "short_mp4") {
      const target = join(output, "short-720.mp4");
      await run(ffmpeg, buildShortArgs(source, target));
      mediaPath = `${prefix}short-720.mp4`;
      format = "mp4";
    } else {
      for (const name of ["360p", "480p", "720p"]) await mkdir(join(output, name), { recursive: true });
      await run(ffmpeg, buildHlsArgs(source, output, hasAudio));
      mediaPath = `${prefix}master.m3u8`;
      format = "hls";
    }

    await assertJobStillAllowed(database, job.id, asset.content_id);
    const uploaded = await uploadDirectory(output, prefix);
    if (!uploaded.includes(thumbnailPath) || !uploaded.includes(mediaPath)) {
      throw new Error("Required processed media output was not uploaded.");
    }

    await assertJobStillAllowed(database, job.id, asset.content_id);
    const { error: assetUpdateError } = await database.from("media_assets").update({
      status: "ready",
      is_available: false,
      duration_seconds: probe.durationSeconds ? Math.round(probe.durationSeconds) : null,
      metadata: {
        ...asset.metadata,
        probe: { ...probe, hasAudio },
        outputs: uploaded,
        thumbnailPath,
        mediaBackend: mediaBackend(),
      },
    }).eq("id", asset.id);
    if (assetUpdateError) throw assetUpdateError;

    await database.from("playback_sources").update({
      is_primary: false,
      is_available: false,
    }).eq("content_id", asset.content_id);

    const { error: playbackError } = await database.from("playback_sources").insert({
      content_id: asset.content_id,
      provider: "original",
      media_asset_id: asset.id,
      media_url: mediaPath,
      format,
      is_primary: true,
      is_available: false,
      status: "active",
    });
    if (playbackError) throw playbackError;

    const { error: jobUpdateError } = await database.from("media_jobs").update({
      status: "completed",
      completed_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      error_message: null,
      output: {
        mediaPath,
        thumbnailPath,
        format,
        uploaded,
        probe: { ...probe, hasAudio },
        mediaBackend: mediaBackend(),
      },
    }).eq("id", job.id);
    if (jobUpdateError) throw jobUpdateError;
    return { provider: "ffmpeg", deferred: false, mediaPath, thumbnailPath, format };
  } finally {
    await rm(root, { recursive: true, force: true });
  }
}
