import { StudioDrmManager } from "@/components/studio-drm-manager";
import { requireStaff } from "@/lib/studio/auth";

export const metadata = { title: "Protected media" };
export const dynamic = "force-dynamic";

export default async function StudioDrmPage() {
  const { supabase, profile } = await requireStaff();
  const [assets, content, policies, events] = await Promise.all([
    supabase.from("drm_assets").select("id,content_id,media_asset_id,policy_id,provider,provider_asset_ref,key_id,manifest_hls_path,manifest_dash_path,status,packaging_metadata,created_at,updated_at,content_items(slug,title_en,access_level),drm_policies(name,key_systems,minimum_security_level)").order("updated_at", { ascending: false }).limit(100),
    supabase.from("content_items").select("id,slug,title_en,access_level,status,media_assets(id,storage_key,status,kind),rights_records(id,status)").in("hosting_mode", ["self_host_open","self_host_owned"]).order("updated_at", { ascending: false }).limit(200),
    supabase.from("drm_policies").select("id,name,key_systems,licence_duration_seconds,max_concurrent_devices,minimum_security_level").order("name"),
    ["support","admin"].includes(profile.role) ? supabase.from("drm_license_events").select("id,drm_asset_id,key_system,status,reason,request_id,response_ms,created_at").order("created_at", { ascending: false }).limit(100) : Promise.resolve({ data: [] as unknown[], error: null }),
  ]);
  const readiness = { enabled: process.env.ENABLE_WEB_DRM === "true", packagingKey: Boolean(process.env.DRM_PACKAGING_KEY_URL && process.env.DRM_PACKAGING_KEY_AUTHORIZATION), widevine: Boolean(process.env.DRM_WIDEVINE_LICENSE_URL), fairplay: Boolean(process.env.DRM_FAIRPLAY_LICENSE_URL && process.env.DRM_FAIRPLAY_CERTIFICATE_URL) };
  return <div><div className="section-heading"><div><span className="eyebrow">Premium protection</span><h1>Protected media</h1></div></div><StudioDrmManager initialAssets={(assets.data ?? []) as never[]} initialContent={(content.data ?? []) as never[]} policies={(policies.data ?? []) as never[]} licenceEvents={(events.data ?? []) as never[]} readiness={readiness} /></div>;
}
