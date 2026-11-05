const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isCatalogueContentId(value) {
  return typeof value === "string" && UUID_RE.test(value);
}

export function youtubePosterUrl(videoId) {
  const id = String(videoId ?? "").trim();
  if (!/^[A-Za-z0-9_-]{6,32}$/.test(id)) return null;
  return `https://i.ytimg.com/vi/${id}/hqdefault.jpg`;
}

/** Stable same-origin poster URL used on catalogue cards. */
export function cataloguePosterPath(contentId) {
  if (!isCatalogueContentId(contentId)) return null;
  return `/api/catalogue/poster/${contentId}`;
}

/** Fill missing catalogue thumbnails with the public poster route. */
export function withCataloguePosterFallback(item) {
  if (!item) return item;
  if (item.thumbnailUrl) return item;
  if (item.contentType === "live" || item.contentType === "audio") return item;
  const poster = cataloguePosterPath(item.id);
  return poster ? { ...item, thumbnailUrl: poster } : item;
}
