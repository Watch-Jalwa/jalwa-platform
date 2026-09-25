import Link from "next/link";
import { ContentCard } from "@/components/content-card";
import { getPremiumCollections, getPremiumEarlyAccess } from "@/lib/catalogue/repository";
import { getPremiumBenefitState } from "@/lib/premium/server";

export const metadata = { title: "Premium benefits" };
export const dynamic = "force-dynamic";

const benefits = [
  ["premium_catalogue", "Full authorised Jalwa catalogue", "Watch Premium-labelled Jalwa titles."],
  ["early_access", "Jalwa Originals and early access", "See eligible Originals before their public release time."],
  ["jalwa_ads_free", "Ad-free Jalwa interface", "Jalwa-controlled promotional slots are removed."],
  ["enhanced_quality", "Enhanced playback quality", "Unlock the full adaptive HLS ladder up to 720p where available."],
  ["ai_plus", "Larger Ask Jalwa allowance", "50 questions/day by default instead of the free 5/day when Ask Jalwa is enabled."],
  ["premium_collections", "Premium collections", "Open curated Premium-only collections."],
] as const;

export default async function PremiumPage() {
  const state = await getPremiumBenefitState();
  const active = state.benefits.has("premium_catalogue");
  const [earlyAccess, collections] = active
    ? await Promise.all([getPremiumEarlyAccess(), getPremiumCollections()])
    : [[], []];

  return <div className="page-shell premium-hub">
    <section className="pricing-hero">
      <span className="eyebrow">Jalwa Premium</span>
      <h1>{active ? "Your Premium benefits are active." : "Everything included with Premium."}</h1>
      <p>Benefits are enforced from your active server-side entitlements, not browser flags.</p>
      {!active ? <Link className="button button-primary" href="/pricing">Choose Premium</Link> : <Link className="button button-secondary" href="/billing">Manage billing</Link>}
    </section>

    <section className="premium-benefit-grid" aria-label="Premium benefits">
      {benefits.map(([code, title, description]) => {
        const unlocked = state.benefits.has(code);
        return <article className="panel premium-benefit-card" data-benefit-code={code} data-benefit-state={unlocked ? "unlocked" : "locked"} key={code}>
          <span className="eyebrow">{unlocked ? "Unlocked" : "Premium"}</span>
          <h2>{title}</h2>
          <p>{description}</p>
        </article>;
      })}
    </section>

    {active ? <section>
      <div className="section-heading"><div><span className="eyebrow">Before everyone else</span><h2>Early access</h2></div></div>
      {earlyAccess.length ? <div className="content-grid" data-testid="premium-early-access">{earlyAccess.map((item) => <ContentCard item={item} key={item.slug} />)}</div> : <div className="empty-state">No eligible early-access Original is scheduled right now.</div>}
    </section> : null}

    {active ? <section>
      <div className="section-heading"><div><span className="eyebrow">Curated for members</span><h2>Premium collections</h2></div></div>
      {collections.length ? <div className="premium-collection-list" data-testid="premium-collections">{collections.map((collection) => <article className="panel" key={collection.slug}><h3>{collection.title}</h3>{collection.description ? <p>{collection.description}</p> : null}<div className="content-grid">{collection.items.map((item) => <ContentCard item={item} key={item.slug} />)}</div></article>)}</div> : <div className="empty-state">No Premium collection is published right now.</div>}
    </section> : null}
  </div>;
}
