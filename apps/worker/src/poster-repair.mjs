import { mkdir, rm, stat } from "node:fs/promises";
import { join } from "node:path";
import {
  buildThumbnailArgs,
  probeMedia,
  run,
  UNDERSIZED_POSTER_BYTES,
} from "./media.mjs";
import { downloadObject, mediaBackend, uploadProcessedFile, verifyObject } from "./storage.mjs";

function posterCandidates(contentId, assetId, storageKey, mediaUrl) {
  const prefix = `processed/${contentId}/${assetId}/`;
  const candidates = [];
  if (typeof storageKey === "string" && storageKey.trim()) {
    candidates.push({ kind: "incoming", key: storageKey.trim() });
  }
  if (typeof mediaUrl === "string" && mediaUrl.startsWith("processed/") && mediaUrl.endsWith("short-720.mp4")) {
    candidates.push({ kind: "processed", key: mediaUrl });
  }
  candidates.push(
    { kind: "processed", key: `${prefix}short-720.mp4` },
    { kind: "processed", key: `${prefix}720p/segment-00010.ts` },
    { kind: "processed", key: `${prefix}720p/segment-00005.ts` },
    { kind: "processed", key: `${prefix}720p/segment-00001.ts` },
    { kind: "processed", key: `${prefix}480p/segment-00005.ts` },
    { kind: "processed", key: `${prefix}480p/segment-00001.ts` },
  );
  return candidates;
}

async function firstExistingObject(candidates) {
  for (const candidate of candidates) {
    try {
      const info = await verifyObject(candidate.kind, candidate.key);
      if (Number(info?.sizeBytes ?? 0) > 0) return candidate;
    } catch {
      // try next candidate
    }
  }
  return null;
}

/**
 * Rebuild one undersized/black catalogue poster from source or processed media.
 * Returns false when there is nothing to repair in this pass.
 */
export async function repairOneUndersizedPoster(database) {
  if (mediaBackend() !== "r2") return false;

  const { data: items, error } = await database.from("content_items")
    .select("id,slug,content_type,status,thumbnail_url,duration_seconds")
    .eq("status", "published")
    .in("content_type", ["video", "short"])
    .like("thumbnail_url", "/api/catalogue/poster/%")
    .order("updated_at", { ascending: true })
    .limit(40);
  if (error) throw error;
  if (!items?.length) return false;

  for (const item of items) {
    const { data: playback } = await database.from("playback_sources")
      .select("media_asset_id,media_url")
      .eq("content_id", item.id)
      .eq("is_primary", true)
      .eq("status", "active")
      .maybeSingle();
    if (!playback?.media_asset_id) continue;

    const { data: asset } = await database.from("media_assets")
      .select("id,content_id,storage_key,metadata,duration_seconds")
      .eq("id", playback.media_asset_id)
      .maybeSingle();
    if (!asset) continue;

    const thumbnailPath = typeof asset.metadata?.thumbnailPath === "string"
      ? asset.metadata.thumbnailPath
      : `processed/${asset.content_id}/${asset.id}/thumbnail.jpg`;

    let sizeBytes = 0;
    try {
      sizeBytes = Number((await verifyObject("processed", thumbnailPath)).sizeBytes ?? 0);
    } catch {
      sizeBytes = 0;
    }
    if (sizeBytes >= UNDERSIZED_POSTER_BYTES) continue;

    const source = await firstExistingObject(
      posterCandidates(asset.content_id, asset.id, asset.storage_key, playback.media_url),
    );
    if (!source) continue;

    const root = join(process.env.MEDIA_TEMP_DIR ?? "/tmp/jalwa-media", `poster-repair-${asset.id}`);
    const input = join(root, "source");
    const output = join(root, "thumbnail.jpg");
    try {
      await mkdir(root, { recursive: true });
      await downloadObject(source.key, input, source.kind);
      const probe = await probeMedia(input);
      const ffmpeg = process.env.FFMPEG_PATH ?? "ffmpeg";
      await run(
        ffmpeg,
        buildThumbnailArgs(input, output, probe.durationSeconds ?? asset.duration_seconds ?? item.duration_seconds),
      );
      const info = await stat(output);
      if (info.size < UNDERSIZED_POSTER_BYTES) {
        console.warn(JSON.stringify({
          event: "catalogue_poster_repair_still_small",
          contentId: asset.content_id,
          sizeBytes: info.size,
        }));
        continue;
      }
      await uploadProcessedFile(output, thumbnailPath);
      const version = Date.now();
      await database.from("content_items").update({
        thumbnail_url: `/api/catalogue/poster/${asset.content_id}?v=${version}`,
        updated_at: new Date().toISOString(),
      }).eq("id", asset.content_id);
      await database.from("media_assets").update({
        metadata: {
          ...asset.metadata,
          thumbnailPath,
          posterRepairedAt: new Date().toISOString(),
          posterRepairBytes: info.size,
        },
        updated_at: new Date().toISOString(),
      }).eq("id", asset.id);
      console.log(JSON.stringify({
        event: "catalogue_poster_repaired",
        contentId: asset.content_id,
        assetId: asset.id,
        sizeBytes: info.size,
        source: source.key,
      }));
      return true;
    } finally {
      await rm(root, { recursive: true, force: true });
    }
  }
  return false;
}
