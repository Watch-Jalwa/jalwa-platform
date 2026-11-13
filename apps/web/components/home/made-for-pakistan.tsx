import Image from "next/image";
import Link from "next/link";
import type { CatalogueCategory, CatalogueItem } from "@/lib/catalogue/types";
import { CategoryIcon } from "./category-icon";

const BROWSE_FEATURES = [
  { slug: "learn", label: "Learn" },
  { slug: "entertainment", label: "Entertainment" },
  { slug: "history", label: "History" },
] as const;

const FEATURED_BROWSE_CARDS = [
  {
    slug: "grca-animals-broll",
    title: "Animals at Grand Canyon B-Roll",
    fallbackThumbnail: "/catalogue/thumbnails/grca-animals-broll.jpeg",
  },
  {
    slug: "sprite-fright",
    title: "Sprite Fright",
    fallbackThumbnail: "/catalogue/thumbnails/sprite-fright.jpeg",
  },
  {
    slug: "sintel",
    title: "Sintel",
    fallbackThumbnail: "/catalogue/thumbnails/sintel.jpeg",
  },
] as const;

/**
 * Made for Pakistan browse band. The structure is live UI: content cards and
 * category links remain independently clickable instead of being baked into art.
 */
export function MadeForPakistan({
  categories,
  items,
}: {
  categories: CatalogueCategory[];
  items?: CatalogueItem[];
}) {
  const bySlug = new Map(categories.map((category) => [category.slug, category]));
  const tiles = BROWSE_FEATURES.map((feature) => ({
    ...(bySlug.get(feature.slug) ?? { slug: feature.slug, icon: null }),
    label: feature.label,
  }));
  const itemsBySlug = new Map((items ?? []).map((item) => [item.slug, item]));

  return (
    <section className="home-mfp" aria-labelledby="categories-title" data-reveal="up">
      <div className="home-mfp-banner">
        <div className="home-mfp-frame">
          <div className="home-mfp-intro">
            <span className="eyebrow">Browse</span>
            <h2 id="categories-title">Made for Pakistan</h2>
            <p>Original stories, entertainment and learning all in one place.</p>
            <Link className="home-mfp-discover" href="/explore">
              Discover More Now <span aria-hidden="true">→</span>
            </Link>
          </div>
          <div className="home-mfp-card-grid">
            {FEATURED_BROWSE_CARDS.map((card) => {
              const item = itemsBySlug.get(card.slug);
              return (
                <Link className="home-mfp-content-card" href={`/watch/${card.slug}`} key={card.slug}>
                  <Image
                    className="home-mfp-content-art"
                    src={item?.thumbnailUrl ?? card.fallbackThumbnail}
                    alt=""
                    width={640}
                    height={360}
                    unoptimized
                  />
                  <span>{item?.title ?? card.title}</span>
                </Link>
              );
            })}
          </div>
          <nav className="home-mfp-cta-grid" aria-label="Browse categories">
            {tiles.map((category) => (
              <Link key={category.slug} className="home-mfp-cta" href={`/explore?category=${category.slug}`}>
                <CategoryIcon slug={category.slug} />
                <span>{category.label}</span>
              </Link>
            ))}
          </nav>
        </div>
      </div>
    </section>
  );
}
