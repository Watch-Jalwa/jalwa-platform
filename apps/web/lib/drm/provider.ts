type DrmSystem = "widevine" | "fairplay";

type AssetContext = { providerAssetRef?: string | null; keyId?: string | null; contentId: string; drmAssetId: string };

function endpoint(system: DrmSystem) {
  const url = system === "widevine" ? process.env.DRM_WIDEVINE_LICENSE_URL : process.env.DRM_FAIRPLAY_LICENSE_URL;
  if (!url) throw new Error(`${system} licence service is not configured.`);
  return url;
}

function headers(context: AssetContext, contentType: string | null) {
  const result: Record<string,string> = { "content-type": contentType || "application/octet-stream", "x-jalwa-content-id": context.contentId, "x-jalwa-drm-asset-id": context.drmAssetId };
  if (context.providerAssetRef) result["x-jalwa-provider-asset-ref"] = context.providerAssetRef;
  if (context.keyId) result["x-jalwa-key-id"] = context.keyId;
  if (process.env.DRM_PROVIDER_AUTHORIZATION) result.authorization = process.env.DRM_PROVIDER_AUTHORIZATION;
  return result;
}

export async function requestDrmLicence(system: DrmSystem, challenge: ArrayBuffer, context: AssetContext, contentType: string | null) {
  const started = Date.now();
  const response = await fetch(endpoint(system), { method: "POST", headers: headers(context,contentType), body: challenge, signal: AbortSignal.timeout(Number(process.env.DRM_PROVIDER_TIMEOUT_MS ?? 15000)), cache: "no-store" });
  const data = await response.arrayBuffer();
  if (!response.ok) throw Object.assign(new Error(`DRM provider rejected the licence request (${response.status}).`), { status: response.status, responseMs: Date.now()-started });
  return { data, contentType: response.headers.get("content-type") ?? "application/octet-stream", responseMs: Date.now()-started };
}

export async function requestFairPlayCertificate(context: AssetContext) {
  const url = process.env.DRM_FAIRPLAY_CERTIFICATE_URL;
  if (!url) throw new Error("FairPlay certificate service is not configured.");
  const response = await fetch(url, { headers: headers(context,"application/octet-stream"), signal: AbortSignal.timeout(Number(process.env.DRM_PROVIDER_TIMEOUT_MS ?? 15000)), cache: "force-cache" });
  if (!response.ok) throw new Error(`FairPlay certificate request failed (${response.status}).`);
  return { data: await response.arrayBuffer(), contentType: response.headers.get("content-type") ?? "application/octet-stream" };
}
