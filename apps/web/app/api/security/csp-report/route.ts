import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 32 * 1024;
const WINDOW_MS = 60_000;
const LIMIT_PER_WINDOW = 60;
const buckets = new Map<string, { count: number; resetAt: number }>();

function requestKey(request: Request) {
  const address = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const salt = process.env.RATE_LIMIT_SALT || "jalwa-csp-report";
  return createHash("sha256").update(`${salt}:${address}`).digest("hex");
}

function allowed(request: Request) {
  const now = Date.now();
  const key = requestKey(request);
  const current = buckets.get(key);
  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return true;
  }
  if (current.count >= LIMIT_PER_WINDOW) return false;
  current.count += 1;
  if (buckets.size > 5000) {
    for (const [bucketKey, bucket] of buckets) if (bucket.resetAt <= now) buckets.delete(bucketKey);
  }
  return true;
}

function safeText(value: unknown, maximum = 500) {
  return typeof value === "string" ? value.replace(/[\r\n\t]/g, " ").slice(0, maximum) : "";
}

function safeUrl(value: unknown) {
  const text = safeText(value, 2000);
  if (!text) return "";
  if (["inline", "eval", "self", "data", "blob"].includes(text)) return text;
  try {
    const url = new URL(text);
    return `${url.protocol}//${url.host}${url.pathname.slice(0, 500)}`;
  } catch {
    return text.slice(0, 500);
  }
}

function normalizeReports(body: unknown) {
  const rawReports = Array.isArray(body) ? body : [body];
  return rawReports.slice(0, 20).map((entry) => {
    const outer = entry && typeof entry === "object" ? entry as Record<string, unknown> : {};
    const nested = outer["csp-report"];
    const report = nested && typeof nested === "object" ? nested as Record<string, unknown> : outer;
    const reportingBody = outer.body && typeof outer.body === "object" ? outer.body as Record<string, unknown> : report;
    return {
      documentUri: safeUrl(reportingBody["document-uri"] ?? reportingBody.documentURL),
      blockedUri: safeUrl(reportingBody["blocked-uri"] ?? reportingBody.blockedURL),
      effectiveDirective: safeText(reportingBody["effective-directive"] ?? reportingBody.effectiveDirective, 120),
      violatedDirective: safeText(reportingBody["violated-directive"] ?? reportingBody.violatedDirective, 250),
      disposition: safeText(reportingBody.disposition, 30),
      sourceFile: safeUrl(reportingBody["source-file"] ?? reportingBody.sourceFile),
      lineNumber: Number(reportingBody["line-number"] ?? reportingBody.lineNumber) || undefined,
      columnNumber: Number(reportingBody["column-number"] ?? reportingBody.columnNumber) || undefined,
      statusCode: Number(reportingBody["status-code"] ?? reportingBody.statusCode) || undefined,
    };
  });
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });
  if (!allowed(request)) return new NextResponse(null, { status: 204 });

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });

  let body: unknown;
  try {
    body = JSON.parse(raw || "null");
  } catch {
    return new NextResponse(null, { status: 400 });
  }

  const reports = normalizeReports(body);
  if (!reports.length || reports.every((report) => !report.effectiveDirective && !report.violatedDirective)) {
    return new NextResponse(null, { status: 400 });
  }

  console.warn(JSON.stringify({
    event: "csp_violation",
    requestId: request.headers.get("x-request-id") || randomUUID(),
    release: process.env.GIT_SHA || "local",
    reports,
  }));

  return new NextResponse(null, { status: 204, headers: { "Cache-Control": "no-store" } });
}
