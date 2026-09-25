export const PREMIUM_BENEFIT_CODES = Object.freeze([
  "premium_catalogue",
  "early_access",
  "jalwa_ads_free",
  "enhanced_quality",
  "ai_plus",
  "premium_collections",
]);

export function resolveAiDailyLimit(hasAiPlus, freeLimit = 5, premiumLimit = 50) {
  const free = Number.isFinite(Number(freeLimit)) ? Math.max(1, Math.floor(Number(freeLimit))) : 5;
  const premium = Number.isFinite(Number(premiumLimit)) ? Math.max(free, Math.floor(Number(premiumLimit))) : 50;
  return hasAiPlus ? premium : free;
}

export function selectPlaybackPath(mediaPath, format, enhancedQuality) {
  const normalized = String(mediaPath ?? "").replace(/^\/+/, "");
  if (format !== "hls" || enhancedQuality || !normalized.endsWith("/master.m3u8")) {
    return { mediaPath: normalized, qualityTier: enhancedQuality ? "enhanced" : "standard", maxHeight: enhancedQuality ? 720 : null };
  }
  return {
    mediaPath: normalized.replace(/\/master\.m3u8$/, "/480p/index.m3u8"),
    qualityTier: "standard",
    maxHeight: 480,
  };
}
