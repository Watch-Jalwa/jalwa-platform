import Link from "next/link";
import { ContentCard } from "@/components/content-card";
import { FREE_UNLOCKED_VIDEO_LIMIT, summarizeVideoAccess } from "@/lib/catalogue/free-tier-access.mjs";
import { getCategories, searchCatalogue } from "@/lib/catalogue/repository";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  let categories: Awaited<ReturnType<typeof getCategories>> = [];
  let featuredContent: Awaited<ReturnType<typeof searchCatalogue>> = [];
  let accessSummary: {
    totalVideos: number;
    freeUnlocked: number;
    lockedForPremium: number;
    freeLimit: number;
  } = {
    totalVideos: 0,
    freeUnlocked: 0,
    lockedForPremium: 0,
    freeLimit: FREE_UNLOCKED_VIDEO_LIMIT,
  };
  try {
    const [nextCategories, nextFeatured, catalogueWindow] = await Promise.all([
      getCategories(),
      searchCatalogue({ limit: 8 }),
      searchCatalogue({ limit: 100 }),
    ]);
    categories = nextCategories;
    featuredContent = nextFeatured;
    accessSummary = summarizeVideoAccess(catalogueWindow);
  } catch {
    // Keep home reachable for post-JazzCash toast even when catalogue DB is offline locally.
  }
  return (
    <div className="page-shell">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <span className="eyebrow">Jalwa · Pakistan</span>
          <h1 id="hero-title">Pakistan ki kahaniyan, skills aur entertainment aik jagah.</h1>
          <p>Mobile-first discovery for Deen, Kissan, learning, technology, rozgar and family-safe entertainment.</p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/explore">Explore content</Link>
            <Link className="button button-secondary" href="/signup">Signup</Link>
            <Link className="button button-secondary" href="/login">Sign in</Link>
          </div>
        </div>
      </section>

      <section className="tamasha-premium-banner" aria-labelledby="tamasha-premium-title">
        <div className="tamasha-premium-copy">
          <span className="tamasha-premium-kicker">Tamasha Premium</span>
          <h2 id="tamasha-premium-title">Full videos access.</h2>
          <p>
            Full catalogue access · {accessSummary.freeLimit} free videos ·{" "}
            {accessSummary.lockedForPremium > 0
              ? `${accessSummary.lockedForPremium} more unlocked with Monthly`
              : "Premium challenges · Reward eligibility"}
          </p>
        </div>
        <div className="tamasha-premium-cta">
          <strong>Rs 599</strong>
          <small>monthly JazzCash</small>
          <Link className="tamasha-premium-button" href="/pricing">See plans</Link>
        </div>
      </section>

      <section aria-labelledby="categories-title">
        <div className="section-heading"><div><span className="eyebrow">Browse</span><h2 id="categories-title">Made for Pakistan</h2></div></div>
        <div className="category-grid">
          {categories.map((category) => (
            <Link className="category-tile" href={`/explore?category=${category.slug}`} key={category.slug}>
              <span aria-hidden="true">{category.icon}</span><strong>{category.label}</strong><small>{category.urdu}</small>
            </Link>
          ))}
        </div>
      </section>

      <section aria-labelledby="featured-title">
        <div className="section-heading"><div><span className="eyebrow">Now on Jalwa</span><h2 id="featured-title">Featured</h2></div><Link href="/explore">View all</Link></div>
        {featuredContent.length ? <div className="content-grid">{featuredContent.map((item) => <ContentCard item={item} key={item.slug} />)}</div> : <div className="empty-state">Catalogue items will appear after publishing.</div>}
      </section>
    </div>
  );
}
