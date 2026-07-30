import { createClient } from "@supabase/supabase-js";
import { processMediaJob } from "./media.mjs";

const pollIntervalMs = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5000);
const workerId = process.env.WORKER_ID ?? `worker-${process.pid}`;
export function buildHealth() { return { service: "jalwa-worker", status: "ready", version: process.env.GIT_SHA ?? "local", workerId }; }
function configured() { return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.R2_ACCOUNT_ID && process.env.R2_BUCKET); }
function adminClient() { return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } }); }

async function tick() {
  if (!configured()) { console.log(JSON.stringify({ ...buildHealth(), mode: "idle", at: new Date().toISOString() })); return; }
  const supabase = adminClient();
  const { data, error } = await supabase.rpc("claim_media_job", { p_worker_id: workerId });
  if (error) throw error;
  const job = data?.[0]; if (!job) return;
  try {
    await processMediaJob({ supabase, job });
    console.log(JSON.stringify({ event: "media_job_completed", jobId: job.id, workerId }));
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error); const retry = job.attempts < job.max_attempts;
    await supabase.from("media_jobs").update({ status: retry ? "queued" : "failed", available_at: new Date(Date.now() + Math.min(job.attempts * 60000, 300000)).toISOString(), error_message: message.slice(0, 4000), locked_at: null, locked_by: null }).eq("id", job.id);
    await supabase.from("media_assets").update({ status: retry ? "queued" : "failed" }).eq("id", job.media_asset_id);
    console.error(JSON.stringify({ event: "media_job_failed", jobId: job.id, retry, message }));
  }
}

if (process.env.NODE_ENV !== "test") { console.log(JSON.stringify(buildHealth())); await tick().catch((error) => console.error(error)); setInterval(() => void tick().catch((error) => console.error(error)), pollIntervalMs).unref(); }
