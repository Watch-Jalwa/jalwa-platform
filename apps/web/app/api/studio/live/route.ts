import { NextResponse } from "next/server";
import { createCloudflareLiveInput, disableCloudflareLiveInput, getCloudflareLiveInput } from "@/lib/live/cloudflare";
import { createClient } from "@/lib/supabase/server";

async function staff() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { error: NextResponse.json({ error: "Sign in required." }, { status: 401 }) } as const;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !["editor","admin"].includes(profile.role)) return { error: NextResponse.json({ error: "Editor role required." }, { status: 403 }) } as const;
  return { supabase, user } as const;
}

export async function GET(request: Request) {
  const auth = await staff(); if ("error" in auth) return auth.error;
  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    const { data, error } = await auth.supabase.from("live_channels").select("*,live_events(id,title_en,scheduled_start,scheduled_end,status)").order("updated_at", { ascending: false });
    return error ? NextResponse.json({ error: error.message }, { status: 500 }) : NextResponse.json({ channels: data ?? [] });
  }
  const { data: channel } = await auth.supabase.from("live_channels").select("*").eq("id", id).maybeSingle();
  if (!channel) return NextResponse.json({ error: "Channel unavailable." }, { status: 404 });
  if (channel.provider === "cloudflare_stream" && channel.provider_input_id) {
    try {
      const provider = await getCloudflareLiveInput(channel.provider_input_id);
      const status = ["connected","reconnected"].includes(provider.status) ? "live" : ["failed_to_connect","failed_to_reconnect"].includes(provider.status) ? "degraded" : channel.status;
      await auth.supabase.from("live_channels").update({ status, playback_hls_url: provider.playback.hls, playback_dash_url: provider.playback.dash }).eq("id", channel.id);
      await auth.supabase.from("live_health_checks").insert({ channel_id: channel.id, provider_status: provider.status, ingest_connected: status === "live", playback_healthy: status === "live", details: { provider: "cloudflare_stream" } });
      return NextResponse.json({ channel: { ...channel, status }, provider: { uid: provider.uid, status: provider.status, playback: provider.playback } });
    } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Provider status unavailable." }, { status: 502 }); }
  }
  return NextResponse.json({ channel });
}

export async function POST(request: Request) {
  const auth = await staff(); if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => ({})) as { action?: string; id?: string; slug?: string; title?: string; titleUrdu?: string; description?: string; provider?: string; accessLevel?: string; recording?: boolean; lowLatency?: boolean; playbackHlsUrl?: string; playbackDashUrl?: string; publish?: boolean };
  if (body.action === "disable" && body.id) {
    const { data: channel } = await auth.supabase.from("live_channels").select("provider,provider_input_id").eq("id", body.id).maybeSingle();
    if (channel?.provider === "cloudflare_stream" && channel.provider_input_id) await disableCloudflareLiveInput(channel.provider_input_id);
    await auth.supabase.from("live_channels").update({ status: "ended", is_published: false }).eq("id", body.id);
    return NextResponse.json({ ok: true });
  }
  if (!body.slug?.match(/^[a-z0-9]+(?:-[a-z0-9]+)*$/) || !body.title?.trim()) return NextResponse.json({ error: "A valid slug and title are required." }, { status: 400 });
  const provider = body.provider ?? "cloudflare_stream";
  const accessLevel = ["public","registered","premium"].includes(body.accessLevel ?? "") ? body.accessLevel : "public";
  const { data: channel, error: insertError } = await auth.supabase.from("live_channels").insert({ slug: body.slug, title_en: body.title.trim(), title_ur: body.titleUrdu?.trim() || null, description_en: body.description?.trim() || null, provider, access_level: accessLevel, recording_enabled: body.recording !== false, is_published: Boolean(body.publish), status: "offline", playback_hls_url: provider === "cloudflare_stream" ? null : body.playbackHlsUrl ?? null, playback_dash_url: provider === "cloudflare_stream" ? null : body.playbackDashUrl ?? null, created_by: auth.user.id }).select("*").single();
  if (insertError || !channel) return NextResponse.json({ error: insertError?.message ?? "Channel could not be created." }, { status: 400 });
  if (provider !== "cloudflare_stream") return NextResponse.json({ channel });
  try {
    const domain = process.env.PRODUCTION_DOMAIN ?? new URL(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").hostname;
    const created = await createCloudflareLiveInput({ name: body.title.trim(), recording: body.recording !== false, allowedOrigin: domain, signed: accessLevel !== "public", lowLatency: body.lowLatency });
    const { data: updated, error } = await auth.supabase.from("live_channels").update({ provider_input_id: created.uid, playback_hls_url: created.playback.hls, playback_dash_url: created.playback.dash, status: "offline" }).eq("id", channel.id).select("*").single();
    if (error) throw error;
    return NextResponse.json({ channel: updated, ingest: created.ingest, warning: "Copy these ingest credentials now. Jalwa does not persist the stream key or SRT passphrase." });
  } catch (error) {
    await auth.supabase.from("live_channels").delete().eq("id", channel.id);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Live input could not be created." }, { status: 502 });
  }
}

export async function PATCH(request: Request) {
  const auth = await staff(); if ("error" in auth) return auth.error;
  const body = await request.json().catch(() => ({})) as { id?: string; status?: string; publish?: boolean; title?: string; description?: string };
  if (!body.id) return NextResponse.json({ error: "Channel id is required." }, { status: 400 });
  const update: Record<string, unknown> = {};
  if (body.status && ["offline","scheduled","starting","live","degraded","ended"].includes(body.status)) update.status = body.status;
  if (typeof body.publish === "boolean") update.is_published = body.publish;
  if (body.title?.trim()) update.title_en = body.title.trim();
  if (typeof body.description === "string") update.description_en = body.description.trim() || null;
  const { data, error } = await auth.supabase.from("live_channels").update(update).eq("id", body.id).select("*").single();
  return error ? NextResponse.json({ error: error.message }, { status: 400 }) : NextResponse.json({ channel: data });
}
