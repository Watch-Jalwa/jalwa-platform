import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const required = [
  "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY", "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID",
  "R2_SECRET_ACCESS_KEY", "R2_PROCESSED_BUCKET", "MEDIA_SIGNING_SECRET", "NEXT_PUBLIC_MEDIA_GATEWAY_URL",
  "PAYMENT_WEBHOOK_SECRET", "RATE_LIMIT_SALT",
] as const;

export async function GET() {
  const missing = required.filter((name) => !process.env[name]);
  let database = "unavailable";
  if (!missing.includes("NEXT_PUBLIC_SUPABASE_URL") && !missing.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    try {
      const admin = createAdminClient();
      const { error } = await admin.from("content_items").select("id", { head: true, count: "exact" }).limit(1);
      database = error ? "unavailable" : "ready";
    } catch {
      database = "unavailable";
    }
  }

  const ready = missing.length === 0 && database === "ready";
  return NextResponse.json({
    service: "jalwa-web",
    status: ready ? "ready" : "not_ready",
    database,
    missingConfiguration: missing,
    version: process.env.GIT_SHA ?? "local",
    time: new Date().toISOString(),
  }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
