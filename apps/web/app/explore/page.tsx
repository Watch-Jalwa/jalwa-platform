import Link from "next/link";
import { ContentCard } from "@/components/content-card";
import { getCategories, searchCatalogue } from "@/lib/catalogue/repository";

export const metadata = { title: "Explore" };
type SearchParams = Promise<{ q?: string; category?: string }>;

export default async function ExplorePage({ searchParams }: { searchParams: SearchParams }) {
  const { q = "", category = "" } = await searchParams;
  const [categories, content] = await Promise.all([getCategories(), searchCatalogue({ query: q, category })]);
  return (
    <div className="page-shell">
      <div className="section-heading"><div><span className="eyebrow">Catalogue</span><h1>Explore Jalwa</h1></div></div>
      <form className="search-bar" action="/explore" method="get">
        <input aria-label="Search Jalwa" defaultValue={q} name="q" placeholder="Search in Urdu, Roman Urdu or English" />
        {category ? <input name="category" type="hidden" value={category} /> : null}
        <button className="button button-primary" type="submit">Search</button>
      </form>
      <nav className="chip-row" aria-label="Content categories">
        <Link className={!category ? "chip chip-active" : "chip"} href={q ? `/explore?q=${encodeURIComponent(q)}` : "/explore"}>All</Link>
        {categories.map((item) => {
          const href = `/explore?category=${item.slug}${q ? `&q=${encodeURIComponent(q)}` : ""}`;
          return <Link className={category === item.slug ? "chip chip-active" : "chip"} href={href} key={item.slug}>{item.label}</Link>;
        })}
      </nav>
      <p className="result-summary">{content.length} result{content.length === 1 ? "" : "s"}{q ? ` for “${q}”` : ""}</p>
      {content.length ? <div className="content-grid">{content.map((item) => <ContentCard item={item} key={item.slug} />)}</div> : <div className="empty-state"><h2>No matching content</h2><p>Try a broader term or another category.</p></div>}
    </div>
  );
}
