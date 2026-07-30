import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { signPlaybackToken } from "@/lib/media/token.mjs";

export const runtime = "nodejs";
type Params = Promise<{ contentId: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  const { contentId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { data: content } = await supabase.from("content_items").select("id,access_level,status").eq("id", contentId).maybeSingle();
  if (!content || content.status !== "published") return NextResponse.json({ error: "Content unavailable." }, { status: 404 });
  if (content.access_level === "registered" && !user) return NextResponse.json({ error: "Sign in required.", code: "sign_in_required" }, { status: 401 });

  let deviceId: string | null = null;
  if (user && content.access_level !== "public") {
    const deviceKey = request.headers.get("x-jalwa-device-key")?.trim();
    if (!deviceKey) return NextResponse.json({ error: "Register this browser before protected playback.", code: "device_required" }, { status: 428 });
    const { data, error } = await supabase.rpc("register_device", { p_device_key: deviceKey, p_display_name: "Playback browser", p_platform: request.headers.get("sec-ch-ua-platform") ?? "", p_user_agent: request.headers.get("user-agent") ?? "" });
    if (error) return NextResponse.json({ error: error.message === "device revoked" ? "This device was revoked from your account." : error.message, code: error.message === "active device limit reached" ? "device_limit" : "device_blocked" }, { status: 403 });
    deviceId = data;
  }

  if (content.access_level === "premium") {
    if (!user) return NextResponse.json({ error: "Sign in required.", code: "sign_in_required" }, { status: 401 });
    const { data: entitled } = await supabase.rpc("has_active_benefit", { p_benefit: "premium_catalogue" });
    if (!entitled) return NextResponse.json({ error: "Premium entitlement is required.", code: "payment_required" }, { status: 402 });
  }

  const { data: playback } = await supabase.from("playback_sources").select("media_asset_id,media_url,format").eq("content_id", contentId).eq("is_primary", true).eq("status", "active").maybeSingle();
  if (!playback?.media_asset_id || !playback.media_url) return NextResponse.json({ error: "Playback is not ready." }, { status: 409 });
  const secret = process.env.MEDIA_SIGNING_SECRET;
  const gateway = process.env.NEXT_PUBLIC_MEDIA_GATEWAY_URL;
  if (!secret || !gateway) return NextResponse.json({ error: "Playback gateway is not configured." }, { status: 503 });
  const token = signPlaybackToken({ assetId: playback.media_asset_id, pathPrefix: `processed/${contentId}/${playback.media_asset_id}/`, userId: user?.id ?? null, deviceId: deviceId ? createHash("sha256").update(deviceId).digest("hex").slice(0,24) : null }, secret, 300);
  const mediaPath = playback.media_url.replace(/^\/+/, "");
  return NextResponse.json({ url: `${gateway.replace(/\/$/, "")}/${mediaPath}?token=${encodeURIComponent(token)}`, format: playback.format, expiresIn: 300 });
}
