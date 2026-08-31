import { NextResponse } from "next/server";
import { requestFairPlayCertificate } from "@/lib/drm/provider";
import { createAdminClient } from "@/lib/database/admin";
import { createClient } from "@/lib/database/server";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const contentId = new URL(request.url).searchParams.get("contentId");
  if (!contentId) return NextResponse.json({ error: "Content id required." }, { status: 400 });
  const database = await createClient();
  const { data: { user } } = await database.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required.", code: "sign_in_required" }, { status: 401 });
  const { data: content } = await database.from("content_items").select("id,status,access_level").eq("id",contentId).maybeSingle();
  if (!content || content.status!=="published") return NextResponse.json({ error: "Content unavailable." }, { status: 404 });
  if (content.access_level==="premium") {
    const { data: entitled } = await database.rpc("has_active_benefit", { p_benefit: "premium_catalogue" });
    if (!entitled) return NextResponse.json({ error: "Premium entitlement is required.", code: "payment_required" }, { status: 402 });
  }
  const admin = createAdminClient();
  const { data: asset } = await admin.from("drm_assets").select("id,provider_asset_ref,key_id,drm_policies(key_systems)").eq("content_id",contentId).eq("status","ready").maybeSingle();
  if (!asset) return NextResponse.json({ error: "Protected playback is not ready." }, { status: 409 });
  const policy = Array.isArray(asset.drm_policies) ? asset.drm_policies[0] : asset.drm_policies;
  if (policy?.key_systems && !policy.key_systems.includes("com.apple.fps")) return NextResponse.json({ error: "FairPlay is not enabled for this title." }, { status: 403 });
  try {
    const result = await requestFairPlayCertificate({ providerAssetRef: asset.provider_asset_ref, keyId: asset.key_id, contentId, drmAssetId: asset.id });
    return new Response(result.data, { headers: { "content-type": result.contentType, "cache-control": "private, max-age=3600" } });
  } catch {
    return NextResponse.json({ error: "FairPlay certificate unavailable." }, { status: 502 });
  }
}
