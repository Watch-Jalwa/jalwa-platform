import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signPlaybackToken } from "@/lib/media/token.mjs";

export const runtime = "nodejs";
type Params = Promise<{ contentId: string }>;

export async function POST(_: Request, { params }: { params: Params }) {
  const { contentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: content } = await supabase
    .from("content_items")
    .select("id,access_level,status")
    .eq("id", contentId)
    .maybeSingle();

  if (!content || content.status !== "published") return NextResponse.json({ error: "Content unavailable." }, { status: 404 });
  if (content.access_level === "registered" && !user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  if (content.access_level === "premium") {
    if (!user) return NextResponse.json({ error: "Sign in required.", code: "sign_in_required" }, { status: 401 });
    const { data: entitled } = await supabase.rpc("has_active_benefit", { p_benefit: "premium_catalogue" });
    if (!entitled) return NextResponse.json({ error: "Premium entitlement is required.", code: "payment_required" }, { status: 402 });
  }

  const { data: playback } = await supabase
    .from("playback_sources")
    .select("media_asset_id,media_url,format")
    .eq("content_id", contentId)
    .eq("is_primary", true)
    .eq("status", "active")
    .maybeSingle();

  if (!playback?.media_asset_id || !playback.media_url) return NextResponse.json({ error: "Playback is not ready." }, { status: 409 });
  const secret = process.env.MEDIA_SIGNING_SECRET;
  const gateway = process.env.NEXT_PUBLIC_MEDIA_GATEWAY_URL;
  if (!secret || !gateway) return NextResponse.json({ error: "Playback gateway is not configured." }, { status: 503 });

  const token = signPlaybackToken({
    assetId: playback.media_asset_id,
    pathPrefix: `processed/${contentId}/${playback.media_asset_id}/`,
    userId: user?.id ?? null,
  }, secret, 300);

  const mediaPath = playback.media_url.replace(/^\/+/, "");
  return NextResponse.json({
    url: `${gateway.replace(/\/$/, "")}/${mediaPath}?token=${encodeURIComponent(token)}`,
    format: playback.format,
    expiresIn: 300,
  });
}
