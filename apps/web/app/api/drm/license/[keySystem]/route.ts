import { NextResponse } from "next/server";
import { authorizeDrmRequest } from "@/lib/drm/authorize";
import { requestDrmLicence } from "@/lib/drm/provider";
import { createAdminClient } from "@/lib/database/admin";
import { requestRateKey } from "@/lib/security/request-key";

export const runtime = "nodejs";
type Params = Promise<{ keySystem: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  const { keySystem } = await params;
  const system = keySystem === "widevine" ? "widevine" : keySystem === "fairplay" ? "fairplay" : null;
  const contentId = new URL(request.url).searchParams.get("contentId");
  if (!system || !contentId) return NextResponse.json({ error: "Unsupported DRM request." }, { status: 400 });
  const authorization = await authorizeDrmRequest(request, contentId);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error, code: authorization.code }, { status: authorization.status });
  const { asset, userId, deviceId } = authorization.value;
  const expectedKeySystem = system === "widevine" ? "com.widevine.alpha" : "com.apple.fps";
  if (asset.policy && !asset.policy.key_systems.includes(expectedKeySystem)) return NextResponse.json({ error: "Key system is not allowed for this title." }, { status: 403 });
  const contentLength = Number(request.headers.get("content-length") ?? 0);
  if (contentLength > 1024*1024) return NextResponse.json({ error: "Licence challenge is too large." }, { status: 413 });

  const admin = createAdminClient();
  const bucket = requestRateKey(request, `drm:${contentId}:${system}`, userId);
  const { data: allowed, error: rateError } = await admin.rpc("consume_rate_limit", { p_bucket_key: bucket, p_limit: 90, p_window_seconds: 300 });
  if (rateError) return NextResponse.json({ error: "Licence service temporarily unavailable." }, { status: 503 });
  if (!allowed) return NextResponse.json({ error: "Too many licence requests." }, { status: 429 });

  const requestId = crypto.randomUUID(); const started = Date.now();
  try {
    const challenge = await request.arrayBuffer();
    const result = await requestDrmLicence(system, challenge, { providerAssetRef: asset.provider_asset_ref, keyId: asset.key_id, contentId, drmAssetId: asset.id }, request.headers.get("content-type"));
    await admin.from("drm_license_events").insert({ drm_asset_id: asset.id, user_id: userId, device_id: deviceId, key_system: expectedKeySystem, status: "allowed", request_id: requestId, response_ms: result.responseMs });
    return new Response(result.data, { status: 200, headers: { "content-type": result.contentType, "cache-control": "no-store", "x-jalwa-request-id": requestId } });
  } catch (error) {
    const responseMs = typeof error === "object" && error && "responseMs" in error ? Number((error as { responseMs?: number }).responseMs) : Date.now()-started;
    await admin.from("drm_license_events").insert({ drm_asset_id: asset.id, user_id: userId, device_id: deviceId, key_system: expectedKeySystem, status: "upstream_error", reason: error instanceof Error ? error.message.slice(0,500) : "upstream error", request_id: requestId, response_ms: responseMs });
    return NextResponse.json({ error: "The DRM licence service could not complete this request.", requestId }, { status: 502 });
  }
}
