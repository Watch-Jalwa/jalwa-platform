import { NextResponse } from "next/server";
import { emitObservabilityEvent, anonymousFingerprint, requestId } from "@/lib/observability/event";
import { requestRateKey } from "@/lib/security/request-key";
import { createAdminClient } from "@/lib/database/admin";

export const runtime = "nodejs";

const allowedTypes = new Set(["error", "unhandled_rejection", "global_error"]);

export async function POST(request: Request) {
  const id = requestId(request.headers);
  if (Number(request.headers.get("content-length") ?? 0) > 16384) return new NextResponse(null, { status: 413, headers: { "x-request-id": id } });
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > 16384) return new NextResponse(null, { status: 413, headers: { "x-request-id": id } });
  const body = JSON.parse(text || "null") as Record<string, unknown> | null;
  if (!body || !allowedTypes.has(String(body.type ?? ""))) return new NextResponse(null, { status: 400, headers: { "x-request-id": id } });

  try {
    const admin = createAdminClient();
    const subject = anonymousFingerprint(request.headers.get("user-agent") ?? "unknown");
    const { data: allowed } = await admin.rpc("consume_rate_limit", {
      p_bucket_key: requestRateKey(request, "client-error", subject),
      p_limit: 30,
      p_window_seconds: 3600,
    });
    if (!allowed) return new NextResponse(null, { status: 204, headers: { "x-request-id": id } });
  } catch {
    // Observability must never make a user-facing failure worse.
  }

  emitObservabilityEvent({
    level: "error",
    event: `browser.${String(body.type)}`,
    requestId: id,
    context: {
      message: String(body.message ?? "unknown").slice(0, 1000),
      stack: typeof body.stack === "string" ? body.stack.slice(0, 4000) : undefined,
      filename: typeof body.filename === "string" ? body.filename.slice(0, 500) : undefined,
      line: Number(body.line ?? 0) || undefined,
      column: Number(body.column ?? 0) || undefined,
      path: typeof body.path === "string" && body.path.startsWith("/") ? body.path.slice(0, 500) : undefined,
      clientVersion: typeof body.version === "string" ? body.version.slice(0, 80) : undefined,
      userAgentHash: anonymousFingerprint(request.headers.get("user-agent") ?? "unknown"),
    },
  });
  return new NextResponse(null, { status: 204, headers: { "x-request-id": id, "Cache-Control": "no-store" } });
}
