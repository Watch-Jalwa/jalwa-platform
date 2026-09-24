import Link from "next/link";
import { hasActivePremiumBenefit } from "@/lib/premium/access";

export async function JalwaAdSlot({ placement = "global" }: { placement?: string }) {
  const adFree = await hasActivePremiumBenefit("jalwa_ads_free");
  if (adFree) return null;
  return (
    <aside className="jalwa-ad-slot" data-placement={placement} data-testid="jalwa-ad-slot" aria-label="Jalwa promotion">
      <div>
        <span className="eyebrow">Jalwa promotion</span>
        <strong>Go Premium for an ad-free Jalwa interface.</strong>
        <small>Provider-hosted videos may still contain the provider&apos;s own advertising.</small>
      </div>
      <Link className="button button-secondary" href="/pricing">View Premium</Link>
    </aside>
  );
}
