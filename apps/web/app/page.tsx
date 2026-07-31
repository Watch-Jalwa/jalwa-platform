import Link from "next/link";
import { ContentCard } from "@/components/content-card";
import { getCategories, searchCatalogue } from "@/lib/catalogue/repository";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [categories, featuredContent] = await Promise.all([getCategories(), searchCatalogue({ limit: 8 })]);
  return (
    <div className="page-shell">
      <section className="hero" aria-labelledby="hero-title">
        <div className="hero-copy">
          <span className="eyebrow">Jalwa · Pakistan</span>
          <h1 id="hero-title">Pakistan ki kahaniyan, skills aur entertainment — aik jagah.</h1>
          <p>Mobile-first discovery for Deen, Kissan, learning, technology, rozgar and family-safe entertainment.</p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/explore">Explore content</Link>
            <Link className="button button-secondary" href="/login">Sign in</Link>
          </div>
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
