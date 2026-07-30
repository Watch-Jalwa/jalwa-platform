import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ channelId: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  const { channelId } = await params;
  const body = await request.json().catch(() => ({})) as { sessionKey?: string; viewerProfileId?: string | null; watchSeconds?: number; quality?: string | null };
  if (!body.sessionKey || body.sessionKey.length > 120) return NextResponse.json({ error: "Invalid live session." }, { status: 400 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("touch_live_session", { p_channel_id: channelId, p_session_key: body.sessionKey, p_viewer_profile_id: body.viewerProfileId ?? null, p_watch_seconds: Math.max(0,Math.floor(body.watchSeconds ?? 0)), p_quality: body.quality?.slice(0,40) ?? null });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: data });
}
