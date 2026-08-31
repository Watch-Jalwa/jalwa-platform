import { createAdminClient } from "@/lib/database/admin";
import { createClient } from "@/lib/database/server";

export type AuthorizedDrm = {
  userId: string;
  deviceId: string;
  asset: {
    id: string;
    content_id: string;
    media_asset_id: string;
    provider_asset_ref: string | null;
    key_id: string | null;
    manifest_hls_path: string | null;
    manifest_dash_path: string | null;
    certificate_url: string | null;
    key_systems: Record<string,unknown>;
    policy: { key_systems: string[]; licence_duration_seconds: number; max_concurrent_devices: number; minimum_security_level: string } | null;
  };
};

export async function authorizeDrmRequest(request: Request, contentId: string): Promise<{ ok: true; value: AuthorizedDrm } | { ok: false; status: number; code: string; error: string }> {
  const database = await createClient();
  const { data: { user } } = await database.auth.getUser();
  if (!user) return { ok: false, status: 401, code: "sign_in_required", error: "Sign in required for protected playback." };
  const { data: content } = await database.from("content_items").select("id,status,access_level").eq("id", contentId).maybeSingle();
  if (!content || content.status !== "published") return { ok: false, status: 404, code: "content_unavailable", error: "Content unavailable." };
  if (content.access_level === "premium") {
    const { data: entitled } = await database.rpc("has_active_benefit", { p_benefit: "premium_catalogue" });
    if (!entitled) return { ok: false, status: 402, code: "payment_required", error: "Premium entitlement is required." };
  }
  const deviceKey = request.headers.get("x-jalwa-device-key")?.trim();
  if (!deviceKey) return { ok: false, status: 428, code: "device_required", error: "Register this browser before protected playback." };
  const { data: deviceId, error: deviceError } = await database.rpc("register_device", { p_device_key: deviceKey, p_display_name: "DRM browser", p_platform: request.headers.get("sec-ch-ua-platform") ?? "", p_user_agent: request.headers.get("user-agent") ?? "" });
  if (deviceError || !deviceId) return { ok: false, status: 403, code: deviceError?.message === "active device limit reached" ? "device_limit" : "device_blocked", error: deviceError?.message ?? "Browser device unavailable." };
  const admin = createAdminClient();
  const { data: asset, error } = await admin.from("drm_assets").select("id,content_id,media_asset_id,provider_asset_ref,key_id,manifest_hls_path,manifest_dash_path,certificate_url,key_systems,drm_policies(key_systems,licence_duration_seconds,max_concurrent_devices,minimum_security_level)").eq("content_id", contentId).eq("status", "ready").maybeSingle();
  if (error || !asset) return { ok: false, status: 409, code: "drm_not_ready", error: "Protected playback is not ready." };
  const policyValue = Array.isArray(asset.drm_policies) ? asset.drm_policies[0] : asset.drm_policies;
  return { ok: true, value: { userId: user.id, deviceId, asset: { ...asset, key_systems: (asset.key_systems ?? {}) as Record<string,unknown>, policy: policyValue as AuthorizedDrm["asset"]["policy"] } } };
}
