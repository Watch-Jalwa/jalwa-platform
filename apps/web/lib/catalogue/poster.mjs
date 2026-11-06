import { databasePool } from "@/lib/database/pool";
import {
  cataloguePosterPath,
  isCatalogueContentId,
  withCataloguePosterFallback,
  youtubePosterUrl,
} from "./poster-core.mjs";

export {
  cataloguePosterPath,
  isCatalogueContentId,
  withCataloguePosterFallback,
  youtubePosterUrl,
};

/**
 * Resolve a public poster for a published catalogue item.
 * Prefers YouTube provider art, then the FFmpeg frame already stored on R2.
 */
export async function resolveCataloguePoster(contentId) {
  if (!isCatalogueContentId(contentId)) return null;

  const result = await databasePool.query(
    `select c.id::text as id,
            c.status,
            c.content_type,
            c.thumbnail_url,
            ps.provider,
            ps.provider_content_id,
            ps.media_asset_id::text as media_asset_id,
            coalesce(
              ma.metadata->>'thumbnailPath',
              (
                select mj.output->>'thumbnailPath'
                from public.media_jobs mj
                where mj.media_asset_id = ps.media_asset_id
                  and mj.status = 'completed'
                  and mj.output ? 'thumbnailPath'
                order by mj.completed_at desc nulls last
                limit 1
              )
            ) as thumbnail_path
     from public.content_items c
     left join public.playback_sources ps
       on ps.content_id = c.id and ps.is_primary = true and ps.status = 'active'
     left join public.media_assets ma on ma.id = ps.media_asset_id
     where c.id = $1::uuid
     limit 1`,
    [contentId],
  );

  const row = result.rows[0];
  if (!row || row.status !== "published") return null;

  if (row.provider === "youtube" && row.provider_content_id) {
    const youtube = youtubePosterUrl(row.provider_content_id);
    if (youtube) return { kind: "redirect", url: youtube };
  }

  const stored = typeof row.thumbnail_url === "string" ? row.thumbnail_url.trim() : "";
  if (stored && /^https?:\/\//i.test(stored) && !stored.includes("/api/catalogue/poster/")) {
    return { kind: "redirect", url: stored };
  }

  if (row.content_type === "audio") return null;

  const thumbnailPath = typeof row.thumbnail_path === "string" && row.thumbnail_path.startsWith("processed/")
    ? row.thumbnail_path
    : row.media_asset_id
      ? `processed/${row.id}/${row.media_asset_id}/thumbnail.jpg`
      : null;

  if (!thumbnailPath || thumbnailPath.includes("..")) return null;
  return { kind: "object", key: thumbnailPath };
}
