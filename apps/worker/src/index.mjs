import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { processDrmPackagingJob } from "./drm.mjs";
import { processMediaJob } from "./media.mjs";
import { reportWorkerError } from "./observability.mjs";
import { processSourceDownloadJob } from "./source-download.mjs";
import { mediaBackend, storageConfigured } from "./storage.mjs";

const pollIntervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5000);
const workerId = process.env.WORKER_ID ?? `worker-${process.pid}`;
const heartbeatPath = process.env.WORKER_HEARTBEAT_PATH ?? "/tmp/jalwa-worker-heartbeat";
let running = false;

export function buildHealth() {
  return {
    service: "jalwa-worker",
    status: "ready",
    version: process.env.GIT_SHA ?? "local",
    workerId,
    mediaBackend: mediaBackend(),
    transcodeBackend: process.env.TRANSCODE_BACKEND ?? "ffmpeg",
  };
}

function configured() {
  return Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL
    && process.env.SUPABASE_SERVICE_ROLE_KEY
    && storageConfigured()
  );
}

function adminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function heartbeat(status, details = {}) {
  const payload = { ...buildHealth(), status, at: new Date().toISOString(), ...details };
  await writeFile(heartbeatPath, JSON.stringify(payload), { mode: 0o600 });
}

async function handleSourceDownload(supabase) {
  const { data, error } = await supabase.rpc("claim_source_download_job", { p_worker_id: workerId });
  if (error) throw error;
  const job = data?.[0];
  if (!job) return false;

  try {
    const result = await processSourceDownloadJob({ supabase, job });
    console.log(JSON.stringify({
      event: "source_download_completed",
      jobId: job.id,
      sourceItemId: job.source_item_id,
      sizeBytes: result.sizeBytes,
      mediaBackend: mediaBackend(),
      workerId,
      release: process.env.GIT_SHA ?? "local",
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const { data: retry, error: failError } = await supabase.rpc("fail_source_download_job", {
      p_job_id: job.id,
      p_error_message: message,
    });
    if (failError) throw failError;
    await reportWorkerError(error, {
      workerId,
      mechanism: "source_download_job",
      jobId: job.id,
      jobType: "source_download",
      retry: Boolean(retry),
      mediaBackend: mediaBackend(),
      handled: true,
    });
  }
  return true;
}

async function handleMedia(supabase) {
  const { data, error } = await supabase.rpc("claim_media_job", { p_worker_id: workerId });
  if (error) throw error;
  const job = data?.[0];
  if (!job) return false;

  try {
    const result = await processMediaJob({ supabase, job });
    console.log(JSON.stringify({
      event: result?.deferred ? "media_job_dispatched" : "media_job_completed",
      jobId: job.id,
      workerId,
      mediaBackend: mediaBackend(),
      transcodeBackend: process.env.TRANSCODE_BACKEND ?? "ffmpeg",
      release: process.env.GIT_SHA ?? "local",
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const cancelled = /cancel|blocked by rights|blocked by source|blocked by content state/i.test(message);
    const retry = !cancelled && job.attempts < job.max_attempts;
    await supabase.from("media_jobs").update({
      status: retry ? "queued" : "failed",
      available_at: new Date(Date.now() + Math.min(job.attempts * 60000, 300000)).toISOString(),
      error_message: message.slice(0, 4000),
      locked_at: null,
      locked_by: null,
    }).eq("id", job.id);
    await supabase.from("media_assets").update({
      status: retry ? "queued" : "failed",
      is_available: false,
    }).eq("id", job.media_asset_id);
    await reportWorkerError(error, {
      workerId,
      mechanism: "media_job",
      jobId: job.id,
      jobType: "media",
      retry,
      cancelled,
      mediaBackend: mediaBackend(),
      handled: true,
    });
  }
  return true;
}

async function handleDrm(supabase) {
  if (process.env.ENABLE_WEB_DRM !== "true") return false;
  const { data, error } = await supabase.rpc("claim_drm_packaging_job", { p_worker_id: workerId });
  if (error) throw error;
  const job = data?.[0];
  if (!job) return false;

  try {
    await processDrmPackagingJob({ supabase, job });
    console.log(JSON.stringify({
      event: "drm_packaging_completed",
      jobId: job.id,
      workerId,
      release: process.env.GIT_SHA ?? "local",
    }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const retry = job.attempts < job.max_attempts;
    await supabase.from("drm_packaging_jobs").update({
      status: retry ? "queued" : "failed",
      available_at: new Date(Date.now() + Math.min(job.attempts * 60000, 300000)).toISOString(),
      error_message: message.slice(0, 4000),
      locked_at: null,
      locked_by: null,
    }).eq("id", job.id);
    await supabase.from("drm_assets").update({ status: retry ? "pending" : "failed" }).eq("id", job.drm_asset_id);
    await reportWorkerError(error, {
      workerId,
      mechanism: "drm_packaging_job",
      jobId: job.id,
      jobType: "drm",
      retry,
      handled: true,
    });
  }
  return true;
}

async function tick() {
  if (running) return;
  running = true;
  try {
    if (!configured()) {
      await heartbeat("idle", {
        reason: "configuration_missing",
        mediaBackend: mediaBackend(),
      });
      console.log(JSON.stringify({ ...buildHealth(), mode: "idle", at: new Date().toISOString() }));
      return;
    }
    const supabase = adminClient();
    const sourceDownloadClaimed = await handleSourceDownload(supabase);
    const drmClaimed = await handleDrm(supabase);
    const mediaClaimed = await handleMedia(supabase);
    await heartbeat("ready", { sourceDownloadClaimed, drmClaimed, mediaClaimed });
  } finally {
    running = false;
  }
}

async function reportTickFailure(error) {
  await reportWorkerError(error, {
    workerId,
    mechanism: "worker_tick",
    jobType: "poll",
    mediaBackend: mediaBackend(),
    handled: true,
  });
}

function fatal(error, mechanism) {
  const timer = setTimeout(() => process.exit(1), 3500);
  timer.unref();
  void reportWorkerError(error, {
    workerId,
    mechanism,
    mediaBackend: mediaBackend(),
    handled: false,
  }).finally(() => process.exit(1));
}

if (process.env.NODE_ENV !== "test") {
  process.once("uncaughtException", (error) => fatal(error, "uncaughtException"));
  process.once("unhandledRejection", (reason) => fatal(reason, "unhandledRejection"));
  console.log(JSON.stringify(buildHealth()));
  await tick().catch(reportTickFailure);
  setInterval(() => void tick().catch(reportTickFailure), pollIntervalMs).unref();
}
