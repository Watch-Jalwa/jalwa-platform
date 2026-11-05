import { databasePool } from "@/lib/database/pool";
import { createClient } from "@/lib/database/server";
import { canUseDemoData, hasBackendConfiguration } from "@/lib/runtime";
import { featuredContent } from "./demo-data";
import { canPlayVideoContent, FREE_UNLOCKED_VIDEO_LIMIT, isGatedVideoType } from "./free-tier-access-core.mjs";

export { canPlayVideoContent, FREE_UNLOCKED_VIDEO_LIMIT, isGatedVideoType };

let freeUnlockedCache = { at: 0, ids: /** @type {Set<string>} */ (new Set()) };
const FREE_UNLOCKED_CACHE_MS = 30_000;

async function loadFreeUnlockedVideoIds() {
  const now = Date.now();
  if (now - freeUnlockedCache.at < FREE_UNLOCKED_CACHE_MS && freeUnlockedCache.ids.size) {
    return freeUnlockedCache.ids;
  }

  if (canUseDemoData() || !hasBackendConfiguration()) {
    const ids = new Set(
      featuredContent
        .filter((item) => isGatedVideoType(item.contentType))
        .slice(0, FREE_UNLOCKED_VIDEO_LIMIT)
        .map((item) => item.id || `slug:${item.slug}`),
    );
    freeUnlockedCache = { at: now, ids };
    return ids;
  }

  const result = await databasePool.query(
    `select id::text as id
     from public.content_items
     where status = 'published'
       and content_type in ('video', 'short')
     order by coalesce(publish_at, created_at) asc, id asc
     limit $1`,
    [FREE_UNLOCKED_VIDEO_LIMIT],
  );
  const ids = new Set(result.rows.map((row) => String(row.id)));
  freeUnlockedCache = { at: now, ids };
  return ids;
}

/**
 * @returns {Promise<{ signedIn: boolean, premium: boolean, freeUnlockedIds: Set<string> }>}
 */
export async function getViewerVideoAccess() {
  const freeUnlockedIds = await loadFreeUnlockedVideoIds().catch(() => new Set());
  if (!hasBackendConfiguration()) {
    return { signedIn: false, premium: false, freeUnlockedIds };
  }

  try {
    const database = await createClient();
    const { data: { user } } = await database.auth.getUser();
    if (!user) return { signedIn: false, premium: false, freeUnlockedIds };

    const { data: entitled } = await database.rpc("has_active_benefit", { p_benefit: "premium_catalogue" });
    return {
      signedIn: true,
      premium: Boolean(entitled),
      freeUnlockedIds,
    };
  } catch {
    return { signedIn: false, premium: false, freeUnlockedIds };
  }
}

function contentAccessKey(item) {
  return item.id || (item.slug ? `slug:${item.slug}` : null);
}

export async function annotateCatalogueAccess(items) {
  if (!items?.length) return items ?? [];
  const access = await getViewerVideoAccess();
  return items.map((item) => {
    const lockedForViewer = isGatedVideoType(item.contentType)
      && !canPlayVideoContent(access, { contentId: contentAccessKey(item), contentType: item.contentType });
    return {
      ...item,
      lockedForViewer,
      accessLevel: lockedForViewer ? "premium" : item.accessLevel,
    };
  });
}
