import { writeFile } from "node:fs/promises";
import { createClient } from "@supabase/supabase-js";
import { processDrmPackagingJob } from "./drm.mjs";
import { processMediaJob } from "./media.mjs";
import { reportWorkerError } from "./observability.mjs";

const pollIntervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5000);
const workerId = process.env.WORKER_ID ?? `worker-${process.pid}`;
const heartbeatPath = process.env.WORKER_HEARTBEAT_PATH ?? "/tmp/jalwa-worker-heartbeat";
let running = false;

export function buildHealth() { return { service: "jalwa-worker", status: "ready", version: process.env.GIT_SHA ?? "local", workerId }; }
function configured() { return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.R2_ACCOUNT_ID && (process.env.R2_INCOMING_BUCKET || process.env.R2_BUCKET) && (process.env.R2_PROCESSED_BUCKET || process.env.R2_BUCKET)); }
function adminClient() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }); }

async function heartbeat(status, details = {}) {
  const payload = { ...buildHealth(), status, at: new Date().toISOString(), ...details };
  await writeFile(heartbeatPath, JSON.stringify(payload), { mode: 0o600 });
}

async function handleMedia(supabase) {
  const { data, error } = await supabase.rpc("claim_media_job", { p_worker_id: workerId });
  if (error) throw error;
  const job = data?.[0];
  if (!job) return false;
  try {
    await processMediaJob({ supabase, job });
    console.log(JSON.stringify({ event: "media_job_completed", jobId: job.id, workerId }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const retry = job.attempts < job.max_attempts;
    await supabase.from("media_jobs").update({ status: retry ? "queued" : "failed", available_at: new Date(Date.now() + Math.min(job.attempts * 60000, 300000)).toISOString(), error_message: message.slice(0, 4000), locked_at: null, locked_by: null }).eq("id", job.id);
    await supabase.from("media_assets").update({ status: retry ? "queued" : "failed" }).eq("id", job.media_asset_id);
    await reportWorkerError(error, { workerId, mechanism: "media_job", jobId: job.id, jobType: "media", retry, handled: true });
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
    console.log(JSON.stringify({ event: "drm_packaging_completed", jobId: job.id, workerId }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const retry = job.attempts < job.max_attempts;
    await supabase.from("drm_packaging_jobs").update({ status: retry ? "queued" : "failed", available_at: new Date(Date.now() + Math.min(job.attempts * 60000, 300000)).toISOString(), error_message: message.slice(0, 4000), locked_at: null, locked_by: null }).eq("id", job.id);
    await supabase.from("drm_assets").update({ status: retry ? "pending" : "failed" }).eq("id", job.drm_asset_id);
    await reportWorkerError(error, { workerId, mechanism: "drm_packaging_job", jobId: job.id, jobType: "drm", retry, handled: true });
  }
  return true;
}

async function tick() {
  if (running) return;
  running = true;
  try {
    if (!configured()) {
      await heartbeat("idle", { reason: "configuration_missing" });
      console.log(JSON.stringify({ ...buildHealth(), mode: "idle", at: new Date().toISOString() }));
      return;
    }
    const supabase = adminClient();
    const drmClaimed = await handleDrm(supabase);
    const mediaClaimed = await handleMedia(supabase);
    await heartbeat("ready", { drmClaimed, mediaClaimed });
  } finally {
    running = false;
  }
}

async function reportTickFailure(error) {
  await reportWorkerError(error, { workerId, mechanism: "worker_tick", jobType: "poll", handled: true });
}

function fatal(error, mechanism) {
  const timer = setTimeout(() => process.exit(1), 3500);
  timer.unref();
  void reportWorkerError(error, { workerId, mechanism, handled: false }).finally(() => process.exit(1));
}

if (process.env.NODE_ENV !== "test") {
  process.once("uncaughtException", (error) => fatal(error, "uncaughtException"));
  process.once("unhandledRejection", (reason) => fatal(reason, "unhandledRejection"));
  console.log(JSON.stringify(buildHealth()));
  await tick().catch(reportTickFailure);
  setInterval(() => void tick().catch(reportTickFailure), pollIntervalMs).unref();
}
