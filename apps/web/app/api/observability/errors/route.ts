import { createHash, randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { reportServerError } from "@/lib/observability/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BODY_BYTES = 16 * 1024;
const WINDOW_MS = 60_000;
const LIMIT_PER_WINDOW = 20;
const buckets = new Map<string, { count: number; resetAt: number }>();

function clientKey(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const salt = process.env.RATE_LIMIT_SALT || "jalwa-observability";
  return createHash("sha256").update(`${salt}:${forwarded}`).digest("hex");
}

function allowed(request: Request) {
  const now = Date.now();
  const key = clientKey(request);
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

function text(value: unknown, maximum: number) {
  return typeof value === "string" ? value.slice(0, maximum) : "";
}

export async function POST(request: Request) {
  const declaredLength = Number(request.headers.get("content-length") || 0);
  if (declaredLength > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });
  if (!allowed(request)) return new NextResponse(null, { status: 204 });

  const raw = await request.text();
  if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) return new NextResponse(null, { status: 413 });
  const body = JSON.parse(raw || "null") as Record<string, unknown> | null;
  if (!body || typeof body !== "object") return new NextResponse(null, { status: 400 });

  const message = text(body.message, 2000);
  const path = text(body.path, 500);
  if (!message || !path.startsWith("/")) return new NextResponse(null, { status: 400 });

  const error = new Error(message);
  error.name = text(body.type, 100) || "BrowserError";
  const stack = text(body.stack, 10000);
  if (stack) error.stack = stack;

  const requestId = request.headers.get("x-request-id") || randomUUID();
  await reportServerError(error, {
    mechanism: text(body.mechanism, 100) || "browser",
    route: path,
    method: "CLIENT",
    digest: text(body.digest, 200),
    requestId,
    tags: { source: "browser", user_agent_family: request.headers.get("sec-ch-ua")?.slice(0, 200) },
  });

  return NextResponse.json({ accepted: true, requestId }, { status: 202, headers: { "Cache-Control": "no-store" } });
}
