import { createHmac, timingSafeEqual } from "node:crypto";
import { gzipSync } from "node:zlib";
import { NextResponse } from "next/server";
import { deleteAccountExport, putAccountExport } from "@/lib/privacy/storage";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type AccountRequest = {
  id: string;
  user_id: string;
  request_type: "export" | "deletion";
  processing_attempts: number;
  max_attempts: number;
};

function validSecret(request: Request) {
  const expected = process.env.ACCOUNT_REQUEST_PROCESSOR_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !provided) return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function completeExport(admin: ReturnType<typeof createAdminClient>, job: AccountRequest) {
  const { data, error } = await admin.rpc("build_account_export", { p_user_id: job.user_id });
  if (error) throw error;
  const payload = data && typeof data === "object" && !Array.isArray(data)
    ? { requestId: job.id, ...data as Record<string, unknown> }
    : { requestId: job.id, generatedAt: new Date().toISOString(), data };
  const key = `privacy/exports/${job.id}/${crypto.randomUUID()}.json.gz`;
  await putAccountExport(key, gzipSync(Buffer.from(JSON.stringify(payload))), job.id);
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const { error: updateError } = await admin.from("account_requests").update({
    status: "completed",
    completed_at: new Date().toISOString(),
    result_storage_key: key,
    result_expires_at: expiresAt,
    locked_at: null,
    locked_by: null,
    error_message: null,
  }).eq("id", job.id);
  if (updateError) {
    await deleteAccountExport(key).catch(() => undefined);
    throw updateError;
  }
}

async function completeDeletion(admin: ReturnType<typeof createAdminClient>, job: AccountRequest) {
  const { data: profile, error: profileError } = await admin.from("profiles").select("role").eq("id", job.user_id).maybeSingle();
  if (profileError) throw profileError;
  if (!profile || !["viewer", "subscriber"].includes(profile.role)) {
    await admin.from("account_requests").update({ status: "rejected", completed_at: new Date().toISOString(), internal_note: "Staff and unknown accounts require an administrator-led offboarding procedure.", locked_at: null, locked_by: null }).eq("id", job.id);
    return;
  }

  const { data: identity, error: identityError } = await admin.auth.admin.getUserById(job.user_id);
  if (identityError) throw identityError;
  const hashSecret = process.env.ACCOUNT_DELETION_HASH_SECRET ?? process.env.RATE_LIMIT_SALT;
  if (!hashSecret) throw new Error("Account deletion hash secret is not configured.");
  const subject = `${job.user_id}:${identity.user.email ?? identity.user.phone ?? "no-contact"}`;
  const subjectHash = createHmac("sha256", hashSecret).update(subject).digest("hex");

  const { data: exports } = await admin.from("account_requests").select("result_storage_key").eq("user_id", job.user_id).eq("request_type", "export").not("result_storage_key", "is", null);
  for (const record of exports ?? []) {
    if (record.result_storage_key) await deleteAccountExport(record.result_storage_key).catch(() => undefined);
  }

  const { error: deidentifyError } = await admin.rpc("deidentify_retained_account_records", { p_user_id: job.user_id, p_subject_hash: subjectHash });
  if (deidentifyError) throw deidentifyError;
  const { error: deleteError } = await admin.auth.admin.deleteUser(job.user_id);
  if (deleteError) throw deleteError;

  const { error: requestError } = await admin.from("account_requests").update({
    status: "completed",
    completed_at: new Date().toISOString(),
    subject_hash: subjectHash,
    result_storage_key: null,
    result_expires_at: null,
    locked_at: null,
    locked_by: null,
    error_message: null,
    internal_note: "Account deleted after grace period; retained records de-identified.",
  }).eq("id", job.id);
  if (requestError) throw requestError;
}

async function failJob(admin: ReturnType<typeof createAdminClient>, job: AccountRequest, error: unknown) {
  const message = error instanceof Error ? error.message : "Account request processing failed.";
  const retryMinutes = Math.min(Math.max(job.processing_attempts, 1) * 15, 180);
  await admin.from("account_requests").update({
    status: "failed",
    available_at: new Date(Date.now() + retryMinutes * 60 * 1000).toISOString(),
    error_message: message.slice(0, 1000),
    locked_at: null,
    locked_by: null,
  }).eq("id", job.id);
}

export async function POST(request: Request) {
  if (!validSecret(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const admin = createAdminClient();
  const workerId = `account-request-${process.env.GIT_SHA ?? "local"}-${process.pid}`;
  let completed = 0;
  let failed = 0;

  for (let index = 0; index < 3; index += 1) {
    const { data, error } = await admin.rpc("claim_account_request", { p_worker_id: workerId });
    if (error) return NextResponse.json({ error: "Account request queue unavailable." }, { status: 500 });
    const job = (data?.[0] ?? null) as AccountRequest | null;
    if (!job) break;
    try {
      if (job.request_type === "export") await completeExport(admin, job);
      else await completeDeletion(admin, job);
      completed += 1;
    } catch (jobError) {
      console.error("account_request_failed", { requestId: job.id, type: job.request_type, message: jobError instanceof Error ? jobError.message : String(jobError) });
      await failJob(admin, job, jobError);
      failed += 1;
    }
  }

  return NextResponse.json({ completed, failed, processedAt: new Date().toISOString() });
}
