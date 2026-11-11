import { databasePool } from "@/lib/database/pool";
import { buildGeneratedPosterSvg } from "./generated-poster.mjs";
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
  buildGeneratedPosterSvg,
};

/**
 * Resolve a public poster for a published catalogue item.
 * YouTube keeps provider art; self-hosted catalogue uses generated Jalwa posters
 * (not black opening frames from FFmpeg).
 */
export async function resolveCataloguePoster(contentId) {
  if (!isCatalogueContentId(contentId)) return null;

  const result = await databasePool.query(
    `select c.id::text as id,
            c.status,
            c.content_type,
            c.title_en,
            c.duration_seconds,
            c.thumbnail_url,
            cat.name_en as category_name,
            ps.provider,
            ps.provider_content_id
     from public.content_items c
     left join public.categories cat on cat.id = c.primary_category_id
     left join public.playback_sources ps
       on ps.content_id = c.id and ps.is_primary = true and ps.status = 'active'
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

  return {
    kind: "generated",
    id: row.id,
    title: typeof row.title_en === "string" ? row.title_en : "Jalwa",
    category: typeof row.category_name === "string" ? row.category_name : null,
    contentType: typeof row.content_type === "string" ? row.content_type : "video",
    durationSeconds: typeof row.duration_seconds === "number" ? row.duration_seconds : null,
  };
}
