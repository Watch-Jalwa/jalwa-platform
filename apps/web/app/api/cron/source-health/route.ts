import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

async function checkSource(source: { provider: string; provider_content_id: string | null; embed_url: string | null; media_url: string | null; external_url: string | null }) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    let url: string | null = null;
    if (source.provider === "youtube" && source.provider_content_id) url = `https://www.youtube.com/oembed?url=${encodeURIComponent(`https://www.youtube.com/watch?v=${source.provider_content_id}`)}&format=json`;
    else url = source.media_url ?? source.external_url ?? source.embed_url;
    if (!url) return { ok: false, message: "No source URL." };
    const response = await fetch(url, { method: source.provider === "youtube" ? "GET" : "HEAD", redirect: "follow", signal: controller.signal, cache: "no-store", headers: { "user-agent": "Jalwa-Source-Monitor/1.0" } });
    return { ok: response.ok, message: response.ok ? null : `HTTP ${response.status}` };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message.slice(0,200) : "Source check failed." };
  } finally { clearTimeout(timer); }
}

async function handleSourceHealth(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || request.headers.get("authorization") !== `Bearer ${secret}`) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  const admin = createAdminClient();
  const { data: sources, error } = await admin.from("playback_sources").select("id,provider,provider_content_id,embed_url,media_url,external_url,status").eq("status", "active").limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  let healthy = 0; let unavailable = 0;
  for (const source of sources ?? []) {
    const result = await checkSource(source);
    const { data: previous } = await admin.from("playback_source_health").select("consecutive_failures").eq("playback_source_id", source.id).maybeSingle();
    const failures = result.ok ? 0 : (previous?.consecutive_failures ?? 0) + 1;
    const status = result.ok ? "healthy" : failures >= 3 ? "unavailable" : "degraded";
    await admin.from("playback_source_health").upsert({ playback_source_id: source.id, status, consecutive_failures: failures, checked_at: new Date().toISOString(), message: result.message }, { onConflict: "playback_source_id" });
    if (result.ok) healthy += 1; else unavailable += 1;
  }
  return NextResponse.json({ checked: sources?.length ?? 0, healthy, unavailable });
}

export const GET = handleSourceHealth;
export const POST = handleSourceHealth;
