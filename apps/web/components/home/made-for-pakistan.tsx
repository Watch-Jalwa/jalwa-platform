import Image from "next/image";
import Link from "next/link";
import type { CatalogueCategory } from "@/lib/catalogue/types";
import { CategoryIcon } from "./category-icon";

/** Banner tile order matches the Made-for-Pakistan vector art. */
const BANNER_CATEGORY_ORDER = [
  "originals",
  "shorts",
  "entertainment",
  "deen",
  "kissan",
  "learn",
  "tech",
  "rozgar",
  "pakistan",
  "kids",
  "life",
  "live",
] as const;

/**
 * Made for Pakistan browse band.
 * Hero art is clipped to the illustration (static tile strip removed), then real
 * vector CTA buttons sit inside the same banner frame — aligned, hoverable, mobile-ready.
 */
export function MadeForPakistan({ categories }: { categories: CatalogueCategory[] }) {
  const bySlug = new Map(categories.map((category) => [category.slug, category]));
  const tiles = BANNER_CATEGORY_ORDER.map((slug) => bySlug.get(slug)).filter(
    (category): category is CatalogueCategory => Boolean(category),
  );

  return (
    <section className="home-mfp" aria-labelledby="categories-title" data-reveal="up">
      <div className="home-mfp-banner">
        <div className="home-mfp-frame">
          <div className="home-mfp-art-clip" aria-hidden="true">
            <Image
              unoptimized
              className="home-mfp-art"
              src="/home/made-for-pakistan-banner.jpeg"
              alt=""
              width={1600}
              height={1100}
              sizes="(max-width: 720px) 100vw, 1180px"
              priority={false}
            />
          </div>

          <div className="home-mfp-cta-panel">
            <h2 id="categories-title" className="visually-hidden">
              Made for Pakistan
            </h2>

            <nav className="home-mfp-cta-grid" aria-label="Browse categories">
              {tiles.map((category, index) => (
                <Link
                  key={category.slug}
                  className={`home-mfp-cta${index === 0 ? " is-active" : ""}`}
                  href={`/explore?category=${category.slug}`}
                >
                  <CategoryIcon slug={category.slug} />
                  <span className="home-mfp-cta-label">{category.label}</span>
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </section>
  );
}
