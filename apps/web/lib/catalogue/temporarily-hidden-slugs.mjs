/**
 * Client-requested temporary hide list. Keep reversible — remove slug to restore.
 * Filtered in catalogue browse/watch/recommendations so titles leave the app surface.
 */
export const TEMPORARILY_HIDDEN_CONTENT_SLUGS = Object.freeze([
  "nasa-space-station-views",
  "abrasive-bird-debate-cc0",
  "house-sparrow-tschilp-cc0",
  "huamei-bird-calling-cc0",
]);

const hiddenSlugSet = new Set(TEMPORARILY_HIDDEN_CONTENT_SLUGS);

export function isTemporarilyHiddenSlug(slug) {
  return typeof slug === "string" && hiddenSlugSet.has(slug);
}

export function filterVisibleCatalogueItems(items) {
  if (!items?.length) return items ?? [];
  return items.filter((item) => !isTemporarilyHiddenSlug(item?.slug));
}
