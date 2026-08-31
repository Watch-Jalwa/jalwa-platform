import { NextResponse } from "next/server";
import { getActiveViewerProfile } from "@/lib/customer/active-profile";
import { createClient } from "@/lib/database/server";

export async function GET(request: Request) {
  const contentId = new URL(request.url).searchParams.get("contentId");
  if (!contentId) return NextResponse.json({ positionSeconds: 0 });
  const database = await createClient();
  const { data: { user } } = await database.auth.getUser();
  if (!user) return NextResponse.json({ positionSeconds: 0 });
  const profile = await getActiveViewerProfile(user.id);
  if (!profile) return NextResponse.json({ positionSeconds: 0 });
  const { data } = await database.from("watch_progress").select("position_seconds,completed").eq("user_id", user.id).eq("viewer_profile_id", profile.id).eq("content_id", contentId).maybeSingle();
  return NextResponse.json({ positionSeconds: data?.completed ? 0 : data?.position_seconds ?? 0 });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { contentId?: string; positionSeconds?: number; durationSeconds?: number; completed?: boolean };
  if (!body.contentId || !Number.isFinite(body.positionSeconds)) return NextResponse.json({ error: "Invalid progress." }, { status: 400 });
  const database = await createClient();
  const { data: { user } } = await database.auth.getUser();
  if (!user) return NextResponse.json({ ok: false }, { status: 401 });
  const profile = await getActiveViewerProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Viewer profile unavailable." }, { status: 409 });
  const { error } = await database.rpc("upsert_watch_progress", { p_viewer_profile_id: profile.id, p_content_id: body.contentId, p_position_seconds: Math.max(0, Math.floor(body.positionSeconds ?? 0)), p_duration_seconds: Number.isFinite(body.durationSeconds) ? Math.floor(body.durationSeconds!) : null, p_completed: Boolean(body.completed) });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
