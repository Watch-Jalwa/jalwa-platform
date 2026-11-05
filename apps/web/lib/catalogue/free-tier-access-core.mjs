/** Guests and free accounts may play only this many published videos/shorts. */
export const FREE_UNLOCKED_VIDEO_LIMIT = 10;

export function isGatedVideoType(contentType) {
  return contentType === "video" || contentType === "short";
}

/**
 * Premium + signed-in unlocks all videos. Otherwise only the free unlocked set plays.
 */
export function canPlayVideoContent(access, { contentId, contentType }) {
  if (!isGatedVideoType(contentType)) return true;
  if (access.premium && access.signedIn) return true;
  if (!contentId) return false;
  return access.freeUnlockedIds.has(String(contentId));
}
