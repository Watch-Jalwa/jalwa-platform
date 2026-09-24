export const PREMIUM_BENEFIT_CODES = [
  "premium_catalogue",
  "early_access",
  "jalwa_ads_free",
  "enhanced_quality",
  "ai_plus",
  "premium_collections",
] as const;

export type PremiumBenefitCode = (typeof PREMIUM_BENEFIT_CODES)[number];

function boundedPositiveInteger(value: number | undefined, fallback: number) {
  return Number.isInteger(value) && Number(value) > 0 ? Number(value) : fallback;
}

export function resolveAiDailyLimit(
  hasAiPlus: boolean,
  limits: { free?: number; premium?: number } = {},
) {
  return hasAiPlus
    ? boundedPositiveInteger(limits.premium, 50)
    : boundedPositiveInteger(limits.free, 5);
}

export function resolvePlaybackQuality(hasEnhancedQuality: boolean) {
  return hasEnhancedQuality
    ? { tier: "premium" as const, maxHeight: 720 }
    : { tier: "standard" as const, maxHeight: 480 };
}
