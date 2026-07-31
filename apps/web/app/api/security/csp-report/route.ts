import { NextResponse } from "next/server";
import { anonymousFingerprint, emitObservabilityEvent, requestId } from "@/lib/observability/event";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const id = requestId(request.headers);
  if (Number(request.headers.get("content-length") ?? 0) > 16384) return new NextResponse(null, { status: 413, headers: { "x-request-id": id } });
  const text = await request.text();
  if (Buffer.byteLength(text, "utf8") > 16384) return new NextResponse(null, { status: 413, headers: { "x-request-id": id } });
  const parsed = JSON.parse(text || "null") as Record<string, unknown> | null;
  if (!parsed) return new NextResponse(null, { status: 400, headers: { "x-request-id": id } });
  const report = (parsed["csp-report"] ?? parsed.body ?? parsed) as Record<string, unknown>;
  emitObservabilityEvent({
    level: "warning",
    event: "security.csp_violation",
    requestId: id,
    context: {
      documentUri: typeof report["document-uri"] === "string" ? report["document-uri"].split("?")[0].slice(0, 500) : undefined,
      blockedUri: typeof report["blocked-uri"] === "string" ? report["blocked-uri"].split("?")[0].slice(0, 500) : undefined,
      effectiveDirective: String(report["effective-directive"] ?? report.effectiveDirective ?? "unknown").slice(0, 120),
      disposition: String(report.disposition ?? "unknown").slice(0, 40),
      sourceFile: typeof report["source-file"] === "string" ? report["source-file"].split("?")[0].slice(0, 500) : undefined,
      userAgentHash: anonymousFingerprint(request.headers.get("user-agent") ?? "unknown"),
    },
  });
  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store", "x-request-id": id } });
}
