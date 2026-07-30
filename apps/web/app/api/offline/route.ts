import { NextResponse } from "next/server";
import { getActiveViewerProfile } from "@/lib/customer/active-profile";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { contentId?: string; cacheKey?: string; bytesDownloaded?: number };
  if (!body.contentId || !body.cacheKey?.startsWith("/offline-media/")) return NextResponse.json({ error: "Invalid offline item." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const profile = await getActiveViewerProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Viewer profile unavailable." }, { status: 409 });
  const { error } = await supabase.from("offline_items").upsert({ user_id: user.id, viewer_profile_id: profile.id, content_id: body.contentId, cache_key: body.cacheKey, bytes_downloaded: Math.max(0, Math.floor(body.bytesDownloaded ?? 0)), downloaded_at: new Date().toISOString() }, { onConflict: "user_id,viewer_profile_id,content_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request) {
  const id = new URL(request.url).searchParams.get("id");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (id) await supabase.from("offline_items").delete().eq("id", id).eq("user_id", user.id);
  return NextResponse.json({ ok: true });
}
