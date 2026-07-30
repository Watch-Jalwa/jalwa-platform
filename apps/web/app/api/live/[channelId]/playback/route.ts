import { NextResponse } from "next/server";
import { getActiveViewerProfile } from "@/lib/customer/active-profile";
import { createCloudflarePlaybackToken } from "@/lib/live/cloudflare";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ channelId: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  const { channelId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: channel } = await supabase.from("live_channels").select("id,title_en,access_level,provider,provider_input_id,playback_hls_url,playback_dash_url,status,is_published").eq("id", channelId).maybeSingle();
  if (!channel || !channel.is_published) return NextResponse.json({ error: "Live channel unavailable." }, { status: 404 });
  if (!["live","starting","degraded"].includes(channel.status)) return NextResponse.json({ error: "This channel is not live yet.", code: "not_live" }, { status: 409 });
  if (channel.access_level !== "public" && !user) return NextResponse.json({ error: "Sign in required.", code: "sign_in_required" }, { status: 401 });
  if (channel.access_level === "premium") {
    const { data: entitled } = await supabase.rpc("has_active_benefit", { p_benefit: "premium_catalogue" });
    if (!entitled) return NextResponse.json({ error: "Premium entitlement is required.", code: "payment_required" }, { status: 402 });
  }
  let viewerProfileId: string | null = null;
  if (user) viewerProfileId = (await getActiveViewerProfile(user.id))?.id ?? null;

  let hls = channel.playback_hls_url;
  let dash = channel.playback_dash_url;
  if (channel.provider === "cloudflare_stream" && channel.provider_input_id && channel.access_level !== "public") {
    const signed = await createCloudflarePlaybackToken(channel.provider_input_id, 600);
    hls = signed.playback.hls; dash = signed.playback.dash;
  }
  if (!hls && !dash) return NextResponse.json({ error: "Live playback is not configured." }, { status: 503 });
  return NextResponse.json({ channelId: channel.id, title: channel.title_en, hls, dash, viewerProfileId, expiresIn: channel.access_level === "public" ? null : 600 });
}
