import Link from "next/link";
import { getPremiumBenefitState } from "@/lib/premium/server";

export async function JalwaAdSlot() {
  const state = await getPremiumBenefitState();
  if (!state.signedIn || state.benefits.has("jalwa_ads_free")) return null;
  return <aside className="jalwa-ad-slot" data-testid="jalwa-ad-slot" aria-label="Jalwa promotion">
    <span className="eyebrow">Jalwa promotion</span>
    <strong>Watch with fewer interruptions.</strong>
    <span>Premium removes Jalwa-controlled promotional placements.</span>
    <Link href="/pricing">View Premium</Link>
  </aside>;
}
