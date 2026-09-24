export const PREMIUM_BENEFIT_CODES = Object.freeze([
  "premium_catalogue",
  "early_access",
  "jalwa_ads_free",
  "enhanced_quality",
  "ai_plus",
  "premium_collections",
]);

function boundedPositiveInteger(value, fallback) {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

export function resolveAiDailyLimit(hasAiPlus, limits = {}) {
  return hasAiPlus
    ? boundedPositiveInteger(limits.premium, 50)
    : boundedPositiveInteger(limits.free, 5);
}

export function resolvePlaybackQuality(hasEnhancedQuality) {
  return hasEnhancedQuality
    ? { tier: "premium", maxHeight: 720 }
    : { tier: "standard", maxHeight: 480 };
}
