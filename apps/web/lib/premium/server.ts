import { createClient } from "@/lib/database/server";
import { hasBackendConfiguration } from "@/lib/runtime";

export type PremiumBenefitCode =
  | "premium_catalogue"
  | "early_access"
  | "jalwa_ads_free"
  | "enhanced_quality"
  | "ai_plus"
  | "premium_collections";

export async function getPremiumBenefitState() {
  if (!hasBackendConfiguration()) return { signedIn: false, benefits: new Set<PremiumBenefitCode>() };
  try {
    const database = await createClient();
    const { data: { user } } = await database.auth.getUser();
    if (!user) return { signedIn: false, benefits: new Set<PremiumBenefitCode>() };
    const now = new Date().toISOString();
    const { data, error } = await database.from("entitlements")
      .select("benefit_code")
      .eq("status", "active")
      .lte("starts_at", now)
      .gt("ends_at", now);
    if (error) throw error;
    return { signedIn: true, benefits: new Set((data ?? []).map((row) => row.benefit_code as PremiumBenefitCode)) };
  } catch {
    return { signedIn: false, benefits: new Set<PremiumBenefitCode>() };
  }
}

export async function hasPremiumBenefit(code: PremiumBenefitCode) {
  const state = await getPremiumBenefitState();
  return state.benefits.has(code);
}
