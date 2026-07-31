import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const required = [
  "NEXT_PUBLIC_APP_URL", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY", "AI_PROVIDER", "AI_API_KEY", "AI_MODEL",
  "R2_ACCOUNT_ID", "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "R2_ENDPOINT",
  "R2_INCOMING_BUCKET", "R2_PROCESSED_BUCKET", "R2_BACKUP_BUCKET",
  "MEDIA_SIGNING_SECRET", "NEXT_PUBLIC_MEDIA_GATEWAY_URL", "MEDIA_GATEWAY_ALLOWED_ORIGINS",
  "PAYMENT_WEBHOOK_SECRET", "RATE_LIMIT_SALT", "RECOMMENDATION_REFRESH_SECRET", "CRON_SECRET",
  "ACCOUNT_REQUEST_PROCESSOR_SECRET", "ACCOUNT_DELETION_HASH_SECRET", "SENTRY_DSN",
] as const;

const liveRequired = ["CLOUDFLARE_STREAM_API_TOKEN", "CLOUDFLARE_STREAM_CUSTOMER_CODE"] as const;
const drmRequired = ["DRM_WIDEVINE_LICENSE_URL", "DRM_FAIRPLAY_LICENSE_URL", "DRM_FAIRPLAY_CERTIFICATE_URL", "DRM_PROVIDER_AUTHORIZATION", "DRM_PACKAGING_KEY_URL", "DRM_PACKAGING_KEY_AUTHORIZATION"] as const;
const paymentRequirements: Record<string, readonly string[]> = {
  payfast: ["PAYFAST_CHECKOUT_URL", "PAYFAST_MERCHANT_ID", "PAYFAST_SECRET"],
  jazzcash: ["JAZZCASH_CHECKOUT_URL", "JAZZCASH_MERCHANT_ID", "JAZZCASH_SECRET"],
  easypaisa: ["EASYPAISA_CHECKOUT_URL", "EASYPAISA_STORE_ID", "EASYPAISA_SECRET"],
};

export async function GET() {
  const liveEnabled = process.env.ENABLE_LIVE_STREAMING === "true";
  const drmEnabled = process.env.ENABLE_WEB_DRM === "true";
  const paymentProvider = process.env.PAYMENT_PROVIDER ?? "unconfigured";
  const paymentNames = paymentRequirements[paymentProvider] ?? [];
  const names = [...required, ...paymentNames, ...(liveEnabled ? liveRequired : []), ...(drmEnabled ? drmRequired : [])];
  const missing = names.filter((name) => !process.env[name]);
  let database = "unavailable";
  let migrations = "unavailable";
  let migrationIssues: Array<{ filename: string; status: string }> = [];

  if (!missing.includes("NEXT_PUBLIC_SUPABASE_URL") && !missing.includes("SUPABASE_SERVICE_ROLE_KEY")) {
    try {
      const admin = createAdminClient();
      const [databaseResult, migrationResult] = await Promise.all([
        admin.from("content_items").select("id", { head: true, count: "exact" }).limit(1),
        admin.from("jalwa_schema_migrations").select("filename,status").neq("status", "applied").limit(10),
      ]);
      database = databaseResult.error ? "unavailable" : "ready";
      if (!migrationResult.error) {
        migrationIssues = (migrationResult.data ?? []) as Array<{ filename: string; status: string }>;
        migrations = migrationIssues.length ? "blocked" : "ready";
      }
    } catch {
      database = "unavailable";
      migrations = "unavailable";
    }
  }

  const frontendPreview = process.env.NEXT_PUBLIC_FRONTEND_PREVIEW === "true" || process.env.VERCEL_ENV === "preview";
  const paymentReady = process.env.NODE_ENV !== "production" || frontendPreview || (Boolean(paymentRequirements[paymentProvider]) && paymentNames.every((name) => Boolean(process.env[name])));
  const liveReady = !liveEnabled || liveRequired.every((name) => Boolean(process.env[name]));
  const drmReady = !drmEnabled || drmRequired.every((name) => Boolean(process.env[name]));
  const ready = missing.length === 0 && database === "ready" && migrations === "ready" && paymentReady && liveReady && drmReady;

  return NextResponse.json({
    service: "jalwa-web",
    status: ready ? "ready" : "not_ready",
    database,
    migrations,
    migrationIssues,
    storage: { incoming: Boolean(process.env.R2_INCOMING_BUCKET), processed: Boolean(process.env.R2_PROCESSED_BUCKET), backups: Boolean(process.env.R2_BACKUP_BUCKET) },
    lifecycle: { sourceHealth: Boolean(process.env.CRON_SECRET), privacyProcessor: Boolean(process.env.ACCOUNT_REQUEST_PROCESSOR_SECRET), recommendationRefresh: Boolean(process.env.RECOMMENDATION_REFRESH_SECRET) },
    observabilityReady: Boolean(process.env.SENTRY_DSN),
    aiProvider: process.env.AI_PROVIDER ?? "unconfigured",
    paymentProvider,
    paymentReady,
    frontendPreview,
    features: { social: true, recommendations: true, live: { enabled: liveEnabled, ready: liveReady }, drm: { enabled: drmEnabled, ready: drmReady, offline: false }, publicOfflineMp4: true },
    authProviders: { email: true, phone: process.env.NEXT_PUBLIC_ENABLE_PHONE_AUTH === "true", google: process.env.NEXT_PUBLIC_ENABLE_GOOGLE_AUTH === "true", apple: process.env.NEXT_PUBLIC_ENABLE_APPLE_AUTH === "true", facebook: process.env.NEXT_PUBLIC_ENABLE_FACEBOOK_AUTH === "true" },
    missingConfiguration: missing,
    version: process.env.GIT_SHA ?? "local",
    time: new Date().toISOString(),
  }, { status: ready ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
