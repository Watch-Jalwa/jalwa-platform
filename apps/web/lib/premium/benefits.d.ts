export const PREMIUM_BENEFIT_CODES: readonly ["premium_catalogue","early_access","jalwa_ads_free","enhanced_quality","ai_plus","premium_collections"];
export function resolveAiDailyLimit(hasAiPlus: boolean, freeLimit?: number, premiumLimit?: number): number;
export function selectPlaybackPath(mediaPath: string, format: string | null | undefined, enhancedQuality: boolean): { mediaPath: string; qualityTier: "enhanced" | "standard"; maxHeight: number | null };
