import { createReadStream, createWriteStream } from "node:fs";
import { mkdir, readdir, rm, stat } from "node:fs/promises";
import { basename, dirname, join, relative } from "node:path";
import { pipeline } from "node:stream/promises";
import { spawn } from "node:child_process";
import { GetObjectCommand, PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

export function buildShortArgs(input, output) {
  return ["-y","-i",input,"-vf","scale=720:1280:force_original_aspect_ratio=decrease,pad=720:1280:(ow-iw)/2:(oh-ih)/2","-c:v","libx264","-preset","veryfast","-crf","23","-c:a","aac","-b:a","128k","-movflags","+faststart",output];
}

export function buildHlsArgs(input, outputDir) {
  return ["-y","-i",input,
    "-filter_complex","[0:v]split=3[v1][v2][v3];[v1]scale=-2:360[v1out];[v2]scale=-2:480[v2out];[v3]scale=-2:720[v3out]",
    "-map","[v1out]","-map","0:a?","-map","[v2out]","-map","0:a?","-map","[v3out]","-map","0:a?",
    "-c:v","libx264","-preset","veryfast","-crf","23","-c:a","aac","-b:a","128k",
    "-f","hls","-hls_time","6","-hls_playlist_type","vod","-hls_flags","independent_segments",
    "-master_pl_name","master.m3u8",
    "-var_stream_map","v:0,a:0,name:360p v:1,a:1,name:480p v:2,a:2,name:720p",
    "-hls_segment_filename",join(outputDir,"%v","segment-%05d.ts"),
    join(outputDir,"%v","index.m3u8")
  ];
}

export function run(command, args) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, { stdio: ["ignore","pipe","pipe"] });
    let stderr = "";
    process.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    process.once("error", reject);
    process.once("exit", (code) => code === 0 ? resolve() : reject(new Error(`${basename(command)} exited ${code}: ${stderr.slice(-2000)}`)));
  });
}

export function capture(command, args) {
  return new Promise((resolve, reject) => {
    const process = spawn(command, args, { stdio: ["ignore","pipe","pipe"] });
    let stdout = ""; let stderr = "";
    process.stdout.on("data", (chunk) => { stdout += chunk.toString(); });
    process.stderr.on("data", (chunk) => { stderr += chunk.toString(); });
    process.once("error", reject);
    process.once("exit", (code) => code === 0 ? resolve(stdout.trim()) : reject(new Error(`${basename(command)} exited ${code}: ${stderr.slice(-2000)}`)));
  });
}

export async function hasAudioStream(input) {
  const result = await capture(process.env.FFPROBE_PATH ?? "ffprobe", ["-v","error","-select_streams","a:0","-show_entries","stream=index","-of","csv=p=0",input]);
  return Boolean(result);
}

function bucket() {
  const value = process.env.R2_BUCKET ?? process.env.R2_PROCESSED_BUCKET;
  if (!value) throw new Error("R2 processed media bucket is not configured.");
  return value;
}

function r2Client() {
  if (!process.env.R2_ACCOUNT_ID || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY) throw new Error("R2 credentials are not configured.");
  return new S3Client({ region: "auto", endpoint: process.env.R2_ENDPOINT ?? `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: process.env.R2_ACCESS_KEY_ID, secretAccessKey: process.env.R2_SECRET_ACCESS_KEY } });
}

export async function downloadObject(key, target) {
  const response = await r2Client().send(new GetObjectCommand({ Bucket: bucket(), Key: key }));
  if (!response.Body) throw new Error("R2 object has no body");
  await mkdir(dirname(target), { recursive: true });
  await pipeline(response.Body, createWriteStream(target));
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true });
  const paths = [];
  for (const entry of entries) { const path = join(directory, entry.name); if (entry.isDirectory()) paths.push(...await walk(path)); else paths.push(path); }
  return paths;
}

function contentType(path) {
  if (path.endsWith(".m3u8")) return "application/vnd.apple.mpegurl";
  if (path.endsWith(".mpd")) return "application/dash+xml";
  if (path.endsWith(".m4s")) return "video/iso.segment";
  if (path.endsWith(".ts")) return "video/mp2t";
  if (path.endsWith(".mp4")) return "video/mp4";
  if (path.endsWith(".vtt")) return "text/vtt";
  return "application/octet-stream";
}

export async function uploadDirectory(directory, prefix) {
  const uploaded = [];
  for (const path of await walk(directory)) {
    const key = `${prefix}${relative(directory, path).replaceAll("\\", "/")}`;
    const info = await stat(path);
    await r2Client().send(new PutObjectCommand({ Bucket: bucket(), Key: key, Body: createReadStream(path), ContentLength: info.size, ContentType: contentType(path) }));
    uploaded.push(key);
  }
  return uploaded;
}

export async function processMediaJob({ supabase, job }) {
  const { data: asset, error } = await supabase.from("media_assets").select("id,content_id,storage_key,metadata").eq("id", job.media_asset_id).single();
  if (error || !asset) throw error ?? new Error("Source asset missing");
  const root = join(process.env.MEDIA_TEMP_DIR ?? "/tmp/jalwa-media", job.id);
  const source = join(root, "source"); const output = join(root, "output"); await mkdir(output, { recursive: true });
  try {
    await downloadObject(asset.storage_key, source);
    const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
    let format; let mediaPath; let uploaded;
    if (job.job_type === "short_mp4") {
      const target = join(output, "short-720.mp4"); await run(ffmpeg, buildShortArgs(source, target));
      const prefix = `processed/${asset.content_id}/${asset.id}/`; uploaded = await uploadDirectory(output, prefix); mediaPath = `${prefix}short-720.mp4`; format = "mp4";
    } else {
      for (const name of ["360p","480p","720p"]) await mkdir(join(output, name), { recursive: true });
      await run(ffmpeg, buildHlsArgs(source, output));
      const prefix = `processed/${asset.content_id}/${asset.id}/`; uploaded = await uploadDirectory(output, prefix); mediaPath = `${prefix}master.m3u8`; format = "hls";
    }
    await supabase.from("media_assets").update({ status: "ready", metadata: { ...asset.metadata, outputs: uploaded } }).eq("id", asset.id);
    await supabase.from("playback_sources").update({ is_primary: false }).eq("content_id", asset.content_id);
    await supabase.from("playback_sources").insert({ content_id: asset.content_id, provider: "original", media_asset_id: asset.id, media_url: mediaPath, format, is_primary: true, status: "active" });
    await supabase.from("media_jobs").update({ status: "completed", completed_at: new Date().toISOString(), output: { mediaPath, format, uploaded } }).eq("id", job.id);
  } finally { await rm(root, { recursive: true, force: true }); }
}
