import { NextResponse } from "next/server";
import { getActiveViewerProfile } from "@/lib/customer/active-profile";
import { createClient } from "@/lib/supabase/server";

const cacheKeyPattern = /^\/offline-media\/(\d{10})-[a-zA-Z0-9_-]{20,80}$/;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  if (!id || !uuidPattern.test(id)) return NextResponse.json({ error: "Invalid offline item." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const profile = await getActiveViewerProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Viewer profile unavailable." }, { status: 409 });
  const { data: item, error } = await supabase.from("offline_items")
    .select("id,cache_key,expires_at,content_items!inner(status,access_level,playback_sources!inner(format,status,is_primary))")
    .eq("id", id).eq("user_id", user.id).eq("viewer_profile_id", profile.id)
    .gt("expires_at", new Date().toISOString()).maybeSingle();
  if (error) return NextResponse.json({ error: "Offline eligibility could not be verified." }, { status: 503 });
  if (!item) return NextResponse.json({ error: "This offline item expired or is unavailable." }, { status: 410 });
  const content = item.content_items as unknown as { status: string; access_level: string; playback_sources: Array<{ format: string; status: string; is_primary: boolean }> };
  const source = content.playback_sources.find((candidate) => candidate.is_primary && candidate.status === "active");
  if (content.status !== "published" || content.access_level !== "public" || source?.format !== "mp4") {
    return NextResponse.json({ error: "This title is no longer eligible for offline playback." }, { status: 410 });
  }
  return NextResponse.json({ ok: true, cacheKey: item.cache_key, expiresAt: item.expires_at }, { headers: { "Cache-Control": "no-store" } });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { contentId?: string; cacheKey?: string; bytesDownloaded?: number; expiresAt?: string };
  const keyMatch = body.cacheKey?.match(cacheKeyPattern);
  if (!body.contentId || !uuidPattern.test(body.contentId) || !keyMatch || !body.expiresAt) return NextResponse.json({ error: "Invalid offline item." }, { status: 400 });

  const expiry = new Date(body.expiresAt);
  const expirySeconds = Math.floor(expiry.getTime() / 1000);
  const keyExpirySeconds = Number(keyMatch[1]);
  const maxTtl = Number(process.env.OFFLINE_PUBLIC_TTL_SECONDS ?? 604800);
  const nowSeconds = Math.floor(Date.now() / 1000);
  if (!Number.isFinite(expirySeconds) || expirySeconds !== keyExpirySeconds || expirySeconds <= nowSeconds + 60 || expirySeconds > nowSeconds + maxTtl + 60) {
    return NextResponse.json({ error: "Invalid offline expiry." }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const profile = await getActiveViewerProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Viewer profile unavailable." }, { status: 409 });

  const [contentResult, playbackResult] = await Promise.all([
    supabase.from("content_items").select("id,status,access_level").eq("id", body.contentId).maybeSingle(),
    supabase.from("playback_sources").select("format,status,is_primary").eq("content_id", body.contentId).eq("is_primary", true).eq("status", "active").maybeSingle(),
  ]);
  if (contentResult.error || playbackResult.error) return NextResponse.json({ error: "Offline eligibility could not be verified." }, { status: 503 });
  if (contentResult.data?.status !== "published" || contentResult.data.access_level !== "public" || playbackResult.data?.format !== "mp4") {
    return NextResponse.json({ error: "Only public self-hosted MP4 titles can be stored offline." }, { status: 403 });
  }

  const bytes = Math.max(0, Math.floor(body.bytesDownloaded ?? 0));
  if (bytes > 5 * 1024 * 1024 * 1024) return NextResponse.json({ error: "Offline file is too large." }, { status: 400 });
  const { error } = await supabase.from("offline_items").upsert({
    user_id: user.id,
    viewer_profile_id: profile.id,
    content_id: body.contentId,
    cache_key: body.cacheKey,
    bytes_downloaded: bytes,
    downloaded_at: new Date().toISOString(),
    expires_at: expiry.toISOString(),
  }, { onConflict: "user_id,viewer_profile_id,content_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, expiresAt: expiry.toISOString() });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (id) await supabase.from("offline_items").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
