import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requestRateKey } from "@/lib/security/request-key";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ channelId: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  const { channelId } = await params;
  const body = await request.json().catch(() => ({})) as { sessionKey?: string; viewerProfileId?: string | null; watchSeconds?: number; quality?: string | null };
  if (!body.sessionKey || !/^[a-zA-Z0-9_-]{8,120}$/.test(body.sessionKey)) return NextResponse.json({ error: "Invalid live session." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: channel } = await supabase.from("live_channels").select("id,is_published").eq("id",channelId).eq("is_published",true).maybeSingle();
  if (!channel) return NextResponse.json({ error: "Live channel unavailable." }, { status: 404 });
  if (body.viewerProfileId && (!user || !(await supabase.from("viewer_profiles").select("id").eq("id",body.viewerProfileId).eq("user_id",user.id).maybeSingle()).data)) return NextResponse.json({ error: "Viewer profile unavailable." }, { status: 403 });

  const admin = createAdminClient();
  const bucket = requestRateKey(request, `live-session:${channelId}`, user?.id ?? body.sessionKey);
  const { data: allowed, error: rateError } = await admin.rpc("consume_rate_limit", { p_bucket_key: bucket, p_limit: 120, p_window_seconds: 300 });
  if (rateError) return NextResponse.json({ error: "Live telemetry unavailable." }, { status: 503 });
  if (!allowed) return NextResponse.json({ error: "Too many telemetry updates." }, { status: 429 });

  const { data: existing } = await admin.from("live_viewer_sessions").select("id,user_id,watch_seconds").eq("channel_id",channelId).eq("session_key",body.sessionKey).maybeSingle();
  if (existing?.user_id && existing.user_id !== user?.id) return NextResponse.json({ error: "Live session conflict." }, { status: 409 });
  const values = { channel_id: channelId, user_id: user?.id ?? null, viewer_profile_id: body.viewerProfileId ?? null, session_key: body.sessionKey, last_seen_at: new Date().toISOString(), watch_seconds: Math.max(existing?.watch_seconds ?? 0, Math.max(0,Math.floor(body.watchSeconds ?? 0))), quality: body.quality?.slice(0,40) ?? null };
  const result = existing ? await admin.from("live_viewer_sessions").update(values).eq("id",existing.id).select("id").single() : await admin.from("live_viewer_sessions").insert(values).select("id").single();
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  return NextResponse.json({ ok: true, id: result.data.id });
}
