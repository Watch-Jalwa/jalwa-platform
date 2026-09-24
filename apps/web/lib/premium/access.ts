import { createClient } from "@/lib/database/server";
import { hasBackendConfiguration } from "@/lib/runtime";
import type { PremiumBenefitCode } from "./benefits";

export async function hasActivePremiumBenefit(benefit: PremiumBenefitCode) {
  if (!hasBackendConfiguration()) return false;
  try {
    const database = await createClient();
    const { data: { user } } = await database.auth.getUser();
    if (!user) return false;
    const { data, error } = await database.rpc("has_active_benefit", { p_benefit: benefit });
    return !error && data === true;
  } catch {
    return false;
  }
}
