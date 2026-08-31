import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { createCloudFrontSignedCookies } from "@/lib/media/cloudfront-signing.mjs";
import { signPlaybackToken } from "@/lib/media/token.mjs";

export const runtime = "nodejs";
type Params = Promise<{ contentId: string }>;

function cleanBaseUrl(value: string) {
  return value.replace(/\/$/, "");
}

function cloudFrontPrivateKey() {
  const encoded = process.env.CLOUDFRONT_PRIVATE_KEY_BASE64?.trim();
  if (encoded) return Buffer.from(encoded, "base64").toString("utf8");
  return process.env.CLOUDFRONT_PRIVATE_KEY?.replaceAll("\\n", "\n") ?? "";
}

function cookieOptions(expires: Date) {
  const domain = process.env.CLOUDFRONT_COOKIE_DOMAIN?.trim();
  return {
    httpOnly: true,
    secure: true,
    sameSite: "lax" as const,
    path: "/",
    expires,
    ...(domain ? { domain } : {}),
  };
}

export async function POST(request: Request, { params }: { params: Params }) {
  const { contentId } = await params;
  const database = await createClient();
  const { data: { user } } = await database.auth.getUser();

  const { data: available, error: availabilityError } = await database.rpc("is_content_effectively_available", {
    p_content_id: contentId,
  });
  if (availabilityError) return NextResponse.json({ error: "Playback availability could not be verified." }, { status: 503 });
  if (!available) return NextResponse.json({ error: "Content unavailable." }, { status: 404 });

  const { data: content } = await database.from("content_items").select("id,access_level,status").eq("id", contentId).maybeSingle();
  if (!content || content.status !== "published") return NextResponse.json({ error: "Content unavailable." }, { status: 404 });
  if (content.access_level === "registered" && !user) return NextResponse.json({ error: "Sign in required.", code: "sign_in_required" }, { status: 401 });

  let deviceId: string | null = null;
  if (user && content.access_level !== "public") {
    const deviceKey = request.headers.get("x-jalwa-device-key")?.trim();
    if (!deviceKey) return NextResponse.json({ error: "Register this browser before protected playback.", code: "device_required" }, { status: 428 });
    const { data, error } = await database.rpc("register_device", {
      p_device_key: deviceKey,
      p_display_name: "Playback browser",
      p_platform: request.headers.get("sec-ch-ua-platform") ?? "",
      p_user_agent: request.headers.get("user-agent") ?? "",
    });
    if (error) {
      return NextResponse.json({
        error: error.message === "device revoked" ? "This device was revoked from your account." : error.message,
        code: error.message === "active device limit reached" ? "device_limit" : "device_blocked",
      }, { status: 403 });
    }
    deviceId = data;
  }

  if (content.access_level === "premium") {
    if (!user) return NextResponse.json({ error: "Sign in required.", code: "sign_in_required" }, { status: 401 });
    const { data: entitled } = await database.rpc("has_active_benefit", { p_benefit: "premium_catalogue" });
    if (!entitled) return NextResponse.json({ error: "Premium entitlement is required.", code: "payment_required" }, { status: 402 });
  }

  const { data: playback } = await database.from("playback_sources")
    .select("media_asset_id,media_url,format,is_available")
    .eq("content_id", contentId)
    .eq("is_primary", true)
    .eq("status", "active")
    .eq("is_available", true)
    .maybeSingle();
  if (!playback?.media_asset_id || !playback.media_url) return NextResponse.json({ error: "Playback is not ready." }, { status: 409 });

  const mediaPath = playback.media_url.replace(/^\/+/, "");
  const pathPrefix = `processed/${contentId}/${playback.media_asset_id}/`;
  if (!mediaPath.startsWith(pathPrefix) || mediaPath.includes("..")) {
    return NextResponse.json({ error: "Playback media path is invalid." }, { status: 409 });
  }
  const ttl = Math.min(Math.max(Number(process.env.MEDIA_PLAYBACK_TTL_SECONDS ?? 300), 60), 900);
  const expires = new Date(Date.now() + ttl * 1000);

  if ((process.env.MEDIA_BACKEND ?? "r2").toLowerCase() === "aws") {
    const cdn = process.env.AWS_MEDIA_CDN_URL;
    const keyPairId = process.env.CLOUDFRONT_KEY_PAIR_ID;
    const privateKey = cloudFrontPrivateKey();
    if (!cdn || !keyPairId || !privateKey) {
      return NextResponse.json({ error: "AWS playback delivery is not configured." }, { status: 503 });
    }
    const baseUrl = cleanBaseUrl(cdn);
    const signed = createCloudFrontSignedCookies({
      resource: `${baseUrl}/${pathPrefix}*`,
      keyPairId,
      privateKey,
      expiresAt: expires,
    });
    const response = NextResponse.json({
      url: `${baseUrl}/${mediaPath}`,
      format: playback.format,
      expiresIn: ttl,
      offlineAllowed: false,
      offlineExpiresIn: 0,
      delivery: "cloudfront",
    }, { headers: { "Cache-Control": "no-store" } });
    for (const [name, value] of Object.entries(signed)) response.cookies.set(name, value, cookieOptions(expires));
    return response;
  }

  const secret = process.env.MEDIA_SIGNING_SECRET;
  const gateway = process.env.NEXT_PUBLIC_MEDIA_GATEWAY_URL;
  if (!secret || !gateway) return NextResponse.json({ error: "Playback gateway is not configured." }, { status: 503 });
  const token = signPlaybackToken({
    assetId: playback.media_asset_id,
    pathPrefix,
    userId: user?.id ?? null,
    deviceId: deviceId ? createHash("sha256").update(deviceId).digest("hex").slice(0, 24) : null,
  }, secret, ttl);
  const offlineAllowed = content.access_level === "public" && playback.format === "mp4";
  return NextResponse.json({
    url: `${cleanBaseUrl(gateway)}/${mediaPath}?token=${encodeURIComponent(token)}`,
    format: playback.format,
    expiresIn: ttl,
    offlineAllowed,
    offlineExpiresIn: offlineAllowed ? Number(process.env.OFFLINE_PUBLIC_TTL_SECONDS ?? 604800) : 0,
    delivery: "r2_gateway",
  }, { headers: { "Cache-Control": "no-store" } });
}
