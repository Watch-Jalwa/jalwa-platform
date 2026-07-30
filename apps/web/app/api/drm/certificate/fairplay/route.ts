import { NextResponse } from "next/server";
import { authorizeDrmRequest } from "@/lib/drm/authorize";
import { requestFairPlayCertificate } from "@/lib/drm/provider";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const contentId = new URL(request.url).searchParams.get("contentId");
  if (!contentId) return NextResponse.json({ error: "Content id required." }, { status: 400 });
  const authorization = await authorizeDrmRequest(request, contentId);
  if (!authorization.ok) return NextResponse.json({ error: authorization.error, code: authorization.code }, { status: authorization.status });
  const { asset } = authorization.value;
  if (asset.policy && !asset.policy.key_systems.includes("com.apple.fps")) return NextResponse.json({ error: "FairPlay is not enabled for this title." }, { status: 403 });
  try {
    const result = await requestFairPlayCertificate({ providerAssetRef: asset.provider_asset_ref, keyId: asset.key_id, contentId, drmAssetId: asset.id });
    return new Response(result.data, { headers: { "content-type": result.contentType, "cache-control": "private, max-age=3600" } });
  } catch {
    return NextResponse.json({ error: "FairPlay certificate unavailable." }, { status: 502 });
  }
}
