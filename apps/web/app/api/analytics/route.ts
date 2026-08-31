import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/database/admin";
import { createClient } from "@/lib/database/server";
import { requestRateKey, safeSessionId } from "@/lib/security/request-key";

export const runtime = "nodejs";

const allowedEvents = new Set([
  "page_view", "content_impression", "play_started", "play_completed", "search_submitted",
  "premium_viewed", "checkout_started", "support_opened", "ai_opened",
]);
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") ?? 0) > 8192) return new NextResponse(null, { status: 413 });
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return new NextResponse(null, { status: 400 });

  const eventName = String(body.eventName ?? "");
  const path = String(body.path ?? "").slice(0, 500);
  const contentId = typeof body.contentId === "string" && uuidPattern.test(body.contentId) ? body.contentId : null;
  const sessionId = safeSessionId(body.sessionId);
  const properties = body.properties && typeof body.properties === "object" && !Array.isArray(body.properties) ? body.properties : {};
  if (!allowedEvents.has(eventName) || !path.startsWith("/")) return new NextResponse(null, { status: 400 });

  const database = await createClient();
  const { data: { user } } = await database.auth.getUser();
  const admin = createAdminClient();
  const { data: allowed } = await admin.rpc("consume_rate_limit", {
    p_bucket_key: requestRateKey(request, "analytics", user?.id ?? sessionId),
    p_limit: 180,
    p_window_seconds: 3600,
  });
  if (!allowed) return new NextResponse(null, { status: 204 });

  await admin.from("analytics_events").insert({
    user_id: user?.id ?? null,
    session_id: sessionId,
    event_name: eventName,
    path,
    content_id: contentId,
    properties,
  });
  return new NextResponse(null, { status: 204 });
}
