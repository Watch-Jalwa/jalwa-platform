import { createHash } from "node:crypto";
import { mkdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { downloadObject, hasAudioStream, run, uploadDirectory } from "./media.mjs";

function assertHex(value, name) {
  if (typeof value !== "string" || !/^[0-9a-f]{32}$/i.test(value)) throw new Error(`${name} must be 16-byte hexadecimal data.`);
  return value.toLowerCase();
}

export function buildVideoArgs(input, output, height) {
  return ["-y","-i",input,"-map","0:v:0","-an","-vf",`scale=-2:${height}`,"-c:v","libx264","-preset","veryfast","-crf",height>=720?"22":"24","-g","144","-keyint_min","144","-sc_threshold","0","-movflags","+faststart",output];
}

export function buildAudioArgs(input, output) {
  return ["-y","-i",input,"-map","0:a:0","-vn","-c:a","aac","-b:a","128k","-movflags","+faststart",output];
}

export function buildPackagerArgs({ inputDir, outputDir, keyId, key, iv, hasAudio = true, protectionSystems = "Widevine,FairPlay" }) {
  const descriptors = [360,480,720].map((height) => `in=${join(inputDir,`${height}.mp4`)},stream=video,output=${join(outputDir,`${height}.mp4`)},segment_template=${join(outputDir,`${height}-$Number$.m4s`)},playlist_name=${height}.m3u8,iframe_playlist_name=${height}-iframe.m3u8,drm_label=${height>=720?"HD":"SD"}`);
  const labels = ["SD","HD"];
  if (hasAudio) {
    descriptors.push(`in=${join(inputDir,"audio.mp4")},stream=audio,output=${join(outputDir,"audio.mp4")},segment_template=${join(outputDir,"audio-$Number$.m4s")},playlist_name=audio.m3u8,drm_label=AUDIO`);
    labels.push("AUDIO");
  }
  const keySpec = labels.map((label) => `label=${label}:key_id=${keyId}:key=${key}${iv?`:iv=${iv}`:""}`).join(",");
  return [...descriptors,"--enable_raw_key_encryption","--keys",keySpec,"--protection_scheme","cbcs","--protection_systems",protectionSystems,"--hls_key_uri",`skd://${keyId}`,"--segment_duration","6","--hls_master_playlist_output",join(outputDir,"master.m3u8"),"--mpd_output",join(outputDir,"manifest.mpd")];
}

async function packagingKey(asset) {
  const endpoint = process.env.DRM_PACKAGING_KEY_URL;
  const authorization = process.env.DRM_PACKAGING_KEY_AUTHORIZATION;
  if (!endpoint || !authorization) throw new Error("DRM packaging key service is not configured.");
  const response = await fetch(endpoint, { method: "POST", headers: { authorization, "content-type": "application/json" }, body: JSON.stringify({ drmAssetId: asset.id, contentId: asset.content_id, mediaAssetId: asset.media_asset_id, provider: asset.provider, providerAssetRef: asset.provider_asset_ref }), signal: AbortSignal.timeout(Number(process.env.DRM_PROVIDER_TIMEOUT_MS ?? 15000)) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error ?? `DRM key service failed (${response.status}).`);
  return { keyId: assertHex(data.keyId,"keyId"), key: assertHex(data.key,"key"), iv: data.iv ? assertHex(data.iv,"iv") : null, providerAssetRef: typeof data.providerAssetRef === "string" ? data.providerAssetRef : asset.provider_asset_ref, protectionSystems: typeof data.protectionSystems === "string" ? data.protectionSystems : "Widevine,FairPlay" };
}

export async function processDrmPackagingJob({ supabase, job }) {
  const { data: asset, error } = await supabase.from("drm_assets").select("id,content_id,media_asset_id,provider,provider_asset_ref,media_assets(storage_key)").eq("id",job.drm_asset_id).single();
  if (error || !asset) throw error ?? new Error("DRM asset missing.");
  const relatedMedia = Array.isArray(asset.media_assets) ? asset.media_assets[0] : asset.media_assets;
  const sourceKey = relatedMedia?.storage_key;
  if (!sourceKey) throw new Error("DRM source media is missing.");
  const root = join(process.env.MEDIA_TEMP_DIR ?? "/tmp/jalwa-media",`drm-${job.id}`); const encoded = join(root,"encoded"); const output = join(root,"output"); const source = join(root,"source");
  await mkdir(encoded,{recursive:true}); await mkdir(output,{recursive:true});
  await supabase.from("drm_assets").update({status:"packaging"}).eq("id",asset.id);
  try {
    await downloadObject(sourceKey,source);
    const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
    for (const height of [360,480,720]) await run(ffmpeg,buildVideoArgs(source,join(encoded,`${height}.mp4`),height));
    const hasAudio = await hasAudioStream(source);
    if (hasAudio) await run(ffmpeg,buildAudioArgs(source,join(encoded,"audio.mp4")));
    const material = await packagingKey(asset);
    await run(process.env.SHAKA_PACKAGER_PATH ?? "packager",buildPackagerArgs({inputDir:encoded,outputDir:output,hasAudio,...material}));
    const prefix = `drm/${asset.content_id}/${asset.id}/`; const uploaded = await uploadDirectory(output,prefix);
    const manifestHls = `${prefix}master.m3u8`; const manifestDash = `${prefix}manifest.mpd`;
    await supabase.from("drm_assets").update({status:"ready",key_id:material.keyId,provider_asset_ref:material.providerAssetRef,manifest_hls_path:manifestHls,manifest_dash_path:manifestDash,packaging_metadata:{outputs:uploaded,packager:"shaka",audio:hasAudio,sourceHash:createHash("sha256").update(sourceKey).digest("hex")}}).eq("id",asset.id);
    await supabase.from("playback_sources").update({is_primary:false}).eq("content_id",asset.content_id);
    await supabase.from("playback_sources").insert({content_id:asset.content_id,provider:"original_drm",media_asset_id:asset.media_asset_id,drm_asset_id:asset.id,media_url:manifestHls,format:"drm_hls",is_primary:true,status:"active"});
    await supabase.from("drm_packaging_jobs").update({status:"completed",completed_at:new Date().toISOString(),locked_at:null,locked_by:null,error_message:null,output:{manifestHls,manifestDash,uploaded}}).eq("id",job.id);
  } finally { await rm(root,{recursive:true,force:true}); }
}
