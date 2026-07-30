import { NextResponse } from "next/server";
import { getActiveViewerProfile } from "@/lib/customer/active-profile";
import { getRecommendations } from "@/lib/recommendations/repository";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const limit = Math.max(1, Math.min(Number(url.searchParams.get("limit") ?? 24), 60));
  const contextContentId = url.searchParams.get("contentId");
  const items = await getRecommendations({ limit, contextContentId });
  return NextResponse.json({ items });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { contentId?: string; eventType?: string; sessionId?: string; value?: number; context?: Record<string, unknown> };
  if (!body.contentId || !body.eventType) return NextResponse.json({ error: "Invalid recommendation event." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ ok: true, anonymous: true });
  const profile = await getActiveViewerProfile(user.id);
  if (!profile) return NextResponse.json({ error: "Viewer profile unavailable." }, { status: 409 });
  const { error } = await supabase.rpc("record_recommendation_event", { p_viewer_profile_id: profile.id, p_content_id: body.contentId, p_event_type: body.eventType, p_session_id: body.sessionId?.slice(0,120) ?? null, p_value: Number.isFinite(body.value) ? body.value : null, p_context: body.context ?? {} });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
