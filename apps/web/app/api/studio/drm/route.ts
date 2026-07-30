import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function authorized() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { response: NextResponse.json({ error: "Sign in required." }, { status: 401 }) } as const;
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (!profile || !["editor","rights_reviewer","support","admin"].includes(profile.role)) return { response: NextResponse.json({ error: "Staff role required." }, { status: 403 }) } as const;
  return { supabase, user, role: profile.role } as const;
}

export async function GET() {
  const auth = await authorized(); if ("response" in auth) return auth.response;
  const [assets, content, policies, events] = await Promise.all([
    auth.supabase.from("drm_assets").select("id,content_id,media_asset_id,policy_id,provider,provider_asset_ref,key_id,manifest_hls_path,manifest_dash_path,status,packaging_metadata,created_at,updated_at,content_items(slug,title_en,access_level),media_assets(storage_key,status),drm_policies(name,key_systems,minimum_security_level)").order("updated_at", { ascending: false }).limit(100),
    auth.supabase.from("content_items").select("id,slug,title_en,access_level,status,media_assets(id,storage_key,status,kind),rights_records(id,status)").in("hosting_mode", ["self_host_open","self_host_owned"]).order("updated_at", { ascending: false }).limit(200),
    auth.supabase.from("drm_policies").select("id,name,key_systems,licence_duration_seconds,max_concurrent_devices,minimum_security_level").order("name"),
    ["support","admin"].includes(auth.role) ? auth.supabase.from("drm_license_events").select("id,drm_asset_id,key_system,status,reason,request_id,response_ms,created_at,profiles(display_name)").order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [] as unknown[], error: null }),
  ]);
  const error = assets.error ?? content.error ?? policies.error ?? events.error;
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ assets: assets.data ?? [], content: content.data ?? [], policies: policies.data ?? [], licenceEvents: events.data ?? [], readiness: { enabled: process.env.ENABLE_WEB_DRM === "true", packagingKey: Boolean(process.env.DRM_PACKAGING_KEY_URL && process.env.DRM_PACKAGING_KEY_AUTHORIZATION), widevine: Boolean(process.env.DRM_WIDEVINE_LICENSE_URL), fairplay: Boolean(process.env.DRM_FAIRPLAY_LICENSE_URL && process.env.DRM_FAIRPLAY_CERTIFICATE_URL) } });
}

export async function POST(request: Request) {
  const auth = await authorized(); if ("response" in auth) return auth.response;
  if (!["editor","admin"].includes(auth.role)) return NextResponse.json({ error: "Editor or admin role required." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { action?: string; contentId?: string; mediaAssetId?: string; policyId?: string; provider?: string; drmAssetId?: string };
  if (body.action === "retry" && body.drmAssetId) {
    const { data: asset } = await auth.supabase.from("drm_assets").select("id,status").eq("id",body.drmAssetId).maybeSingle();
    if (!asset) return NextResponse.json({ error: "DRM asset unavailable." }, { status: 404 });
    const { error } = await auth.supabase.from("drm_packaging_jobs").insert({ drm_asset_id: asset.id });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
    await auth.supabase.from("drm_assets").update({ status: "pending" }).eq("id",asset.id);
    return NextResponse.json({ ok: true });
  }
  if (!body.contentId || !body.mediaAssetId || !body.policyId) return NextResponse.json({ error: "Content, source asset and DRM policy are required." }, { status: 400 });
  const [{ data: content }, { data: media }, { data: rights }, { data: existing }] = await Promise.all([
    auth.supabase.from("content_items").select("id,access_level,hosting_mode").eq("id",body.contentId).maybeSingle(),
    auth.supabase.from("media_assets").select("id,content_id,status,kind").eq("id",body.mediaAssetId).maybeSingle(),
    auth.supabase.from("rights_records").select("id").eq("content_id",body.contentId).eq("status","approved").limit(1),
    auth.supabase.from("drm_assets").select("id").eq("content_id",body.contentId).maybeSingle(),
  ]);
  if (!content || !["self_host_open","self_host_owned"].includes(content.hosting_mode)) return NextResponse.json({ error: "Only self-hosted content can be DRM packaged." }, { status: 400 });
  if (!media || media.content_id!==body.contentId || media.status!=="ready") return NextResponse.json({ error: "A ready source media asset is required." }, { status: 400 });
  if (!rights?.length) return NextResponse.json({ error: "Approved rights are required before DRM packaging." }, { status: 409 });
  if (existing) return NextResponse.json({ error: "This content already has a DRM asset. Retry or revoke the existing asset." }, { status: 409 });
  const provider = ["widevine_fairplay_proxy","external_multi_drm"].includes(body.provider ?? "") ? body.provider : "widevine_fairplay_proxy";
  const { data: asset, error: assetError } = await auth.supabase.from("drm_assets").insert({ content_id: body.contentId, media_asset_id: body.mediaAssetId, policy_id: body.policyId, provider, key_systems: { widevine: true, fairplay: true } }).select("id").single();
  if (assetError || !asset) return NextResponse.json({ error: assetError?.message ?? "DRM asset could not be created." }, { status: 400 });
  const { error: jobError } = await auth.supabase.from("drm_packaging_jobs").insert({ drm_asset_id: asset.id });
  if (jobError) { await auth.supabase.from("drm_assets").delete().eq("id",asset.id); return NextResponse.json({ error: jobError.message }, { status: 400 }); }
  return NextResponse.json({ ok: true, drmAssetId: asset.id }, { status: 201 });
}

export async function PATCH(request: Request) {
  const auth = await authorized(); if ("response" in auth) return auth.response;
  if (auth.role!=="admin") return NextResponse.json({ error: "Admin role required." }, { status: 403 });
  const body = await request.json().catch(() => ({})) as { drmAssetId?: string; action?: string };
  if (!body.drmAssetId || !["revoke","restore"].includes(body.action ?? "")) return NextResponse.json({ error: "Invalid DRM action." }, { status: 400 });
  const status = body.action === "revoke" ? "revoked" : "ready";
  const { error } = await auth.supabase.from("drm_assets").update({ status }).eq("id",body.drmAssetId);
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  if (status === "revoked") await auth.supabase.from("playback_sources").update({ status: "inactive", is_primary: false }).eq("drm_asset_id",body.drmAssetId);
  return NextResponse.json({ ok: true, status });
}
