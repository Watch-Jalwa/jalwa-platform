import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/database/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request) {
  const expected = process.env.AWS_MEDIA_CONTROL_SECRET ?? "";
  const supplied = request.headers.get("x-jalwa-media-callback-secret") ?? "";
  if (!expected || !supplied) return false;
  const left = Buffer.from(expected);
  const right = Buffer.from(supplied);
  return left.length === right.length && timingSafeEqual(left, right);
}

export async function POST(request: Request) {
  if (!authorized(request)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const input = await request.json().catch(() => null) as null | Record<string, unknown>;
  if (!input || typeof input.action !== "string") return NextResponse.json({ error: "Invalid callback." }, { status: 400 });
  const database = createAdminClient();

  if (input.action === "submitted") {
    const { error } = await database.rpc("mark_external_media_job_submitted", {
      p_job_id: input.jobId,
      p_provider_job_id: input.providerJobId,
    });
    if (error) throw error;
    return new NextResponse(null, { status: 204 });
  }

  if (input.action === "completed") {
    const { error } = await database.rpc("complete_external_media_job", {
      p_job_id: input.jobId,
      p_success: input.success,
      p_media_path: input.mediaPath ?? null,
      p_format: input.format,
      p_provider_job_id: input.providerJobId,
      p_error_message: input.errorMessage ?? null,
    });
    if (error) throw error;
    return new NextResponse(null, { status: 204 });
  }

  return NextResponse.json({ error: "Unsupported callback action." }, { status: 400 });
}
