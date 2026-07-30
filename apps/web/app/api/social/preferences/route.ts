import { NextResponse } from "next/server";
import { getActiveViewerProfile } from "@/lib/customer/active-profile";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { action?: string; entityType?: string; entityId?: string; contentId?: string; context?: Record<string, unknown> };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });

  if (["follow","unfollow"].includes(body.action ?? "") && body.entityType && body.entityId) {
    const { error } = await supabase.rpc("set_entity_follow", { p_entity_type: body.entityType, p_entity_id: body.entityId, p_follow: body.action === "follow" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, following: body.action === "follow" });
  }

  if (["mute","unmute"].includes(body.action ?? "") && body.entityType && body.entityId) {
    const { error } = await supabase.rpc("set_user_mute", { p_entity_type: body.entityType, p_entity_id: body.entityId, p_mute: body.action === "mute" });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true, muted: body.action === "mute" });
  }

  if (["hide","report","share","save","like","open"].includes(body.action ?? "") && body.contentId) {
    const profile = await getActiveViewerProfile(user.id);
    if (!profile) return NextResponse.json({ error: "Viewer profile unavailable." }, { status: 409 });
    const eventType = body.action === "report" ? "report" : body.action;
    const { error } = await supabase.rpc("record_recommendation_event", { p_viewer_profile_id: profile.id, p_content_id: body.contentId, p_event_type: eventType, p_session_id: null, p_value: null, p_context: body.context ?? {} });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Unsupported preference action." }, { status: 400 });
}
