import Image from "next/image";
import Link from "next/link";
import { MadeForPakistan } from "@/components/home/made-for-pakistan";
import { PromoBanners } from "@/components/home/promo-banners";
import { TamashaPremiumCard } from "@/components/home/tamasha-premium-card";
import { TrendingRail } from "@/components/home/trending-rail";
import { FREE_UNLOCKED_VIDEO_LIMIT, summarizeVideoAccess } from "@/lib/catalogue/free-tier-access.mjs";
import { getCategories, searchCatalogue } from "@/lib/catalogue/repository";
import "./home-hero.css";

export const dynamic = "force-dynamic";

const HOMEPAGE_TRENDING_SLUGS = [
  "spring-blender",
  "sprite-fright",
  "sintel",
  "apollo-11-eagle-has-landed",
  "caminandes-llamigos",
  "tears-of-steel",
] as const;

export default async function HomePage() {
  let categories: Awaited<ReturnType<typeof getCategories>> = [];
  let trendingContent: Awaited<ReturnType<typeof searchCatalogue>> = [];
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
    const [nextCategories, catalogueWindow] = await Promise.all([
      getCategories(),
      searchCatalogue({ limit: 100 }),
    ]);
    categories = nextCategories;
    const bySlug = new Map(catalogueWindow.map((item) => [item.slug, item]));
    trendingContent = HOMEPAGE_TRENDING_SLUGS
      .map((slug) => bySlug.get(slug))
      .filter((item): item is (typeof catalogueWindow)[number] => Boolean(item));
    accessSummary = summarizeVideoAccess(catalogueWindow);
  } catch {
    // Keep home reachable for post-JazzCash toast even when catalogue DB is offline locally.
  }
  return (
    <div className="page-shell">
      <section className="home-banner-hero" aria-labelledby="hero-title" data-reveal="zoom">
        <div className="home-banner-media" aria-hidden="true">
          <Image
            unoptimized
            loading="eager"
            className="home-banner-image"
            src="/home/homepage-hero-banner.jpeg"
            alt=""
            width={1600}
            height={800}
            decoding="async"
            fetchPriority="high"
          />
        </div>
        <div className="home-banner-copy">
          <div className="home-banner-copy-head">
            <span className="eyebrow">Jalwa · Pakistan</span>
            <h1 id="hero-title">Pakistan ki kahaniyan, skills aur entertainment aik jagah.</h1>
          </div>
          <div className="home-banner-copy-foot">
            <p>
              Mobile-first discovery for learning, technology, rozgar and family-safe entertainment.
            </p>
            <div className="hero-actions">
              <Link className="button button-primary" href="/explore">
                Explore content
              </Link>
              <Link className="button button-secondary" href="/signup">
                Signup
              </Link>
              <Link className="button button-secondary" href="/login">
                Sign in
              </Link>
            </div>
          </div>
        </div>
      </section>

      <TamashaPremiumCard lockedForPremium={accessSummary.lockedForPremium} />

      <MadeForPakistan categories={categories} />

      <section className="home-trending" aria-labelledby="trending-title" data-reveal="up">
        <TrendingRail items={trendingContent} />
      </section>

      <PromoBanners />
    </div>
  );
}
