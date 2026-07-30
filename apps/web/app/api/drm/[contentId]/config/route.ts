import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { authorizeDrmRequest } from "@/lib/drm/authorize";
import { signPlaybackToken } from "@/lib/media/token.mjs";

type Params = Promise<{ contentId: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  const { contentId } = await params;
  const authorization = await authorizeDrmRequest(request, contentId);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error, code: authorization.code }, { status: authorization.status });
  const { asset, userId, deviceId } = authorization.value;
  const gateway = process.env.NEXT_PUBLIC_MEDIA_GATEWAY_URL;
  const secret = process.env.MEDIA_SIGNING_SECRET;
  if (!gateway || !secret) return NextResponse.json({ error: "Protected media gateway is not configured." }, { status: 503 });
  const manifestPath = asset.manifest_hls_path ?? asset.manifest_dash_path;
  if (!manifestPath) return NextResponse.json({ error: "Protected manifest is missing." }, { status: 409 });
  const prefix = `drm/${contentId}/${asset.id}/`;
  const token = signPlaybackToken({ assetId: asset.media_asset_id, pathPrefix: prefix, userId, deviceId: createHash("sha256").update(deviceId).digest("hex").slice(0,24) }, secret, 600);
  const base = gateway.replace(/\/$/, "");
  const signed = (path: string | null) => path ? `${base}/${path.replace(/^\/+/, "")}?token=${encodeURIComponent(token)}` : null;
  const supported = asset.policy?.key_systems ?? Object.keys(asset.key_systems);
  const origin = new URL(process.env.NEXT_PUBLIC_APP_URL ?? request.url).origin;
  return NextResponse.json({
    contentId,
    manifest: { hls: signed(asset.manifest_hls_path), dash: signed(asset.manifest_dash_path), preferred: signed(manifestPath) },
    drmSystems: {
      widevine: supported.includes("com.widevine.alpha") ? { keySystem: "com.widevine.alpha", licenseUrl: `${origin}/api/drm/license/widevine?contentId=${encodeURIComponent(contentId)}` } : null,
      fairplay: supported.includes("com.apple.fps") ? { keySystem: "com.apple.fps", licenseUrl: `${origin}/api/drm/license/fairplay?contentId=${encodeURIComponent(contentId)}`, certificateUrl: `${origin}/api/drm/certificate/fairplay?contentId=${encodeURIComponent(contentId)}` } : null,
    },
    policy: { licenceDurationSeconds: asset.policy?.licence_duration_seconds ?? 21600, minimumSecurityLevel: asset.policy?.minimum_security_level ?? "software", offlineAllowed: false },
    expiresIn: 600,
  });
}
