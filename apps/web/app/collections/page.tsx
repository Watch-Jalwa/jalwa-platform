import Link from "next/link";\nimport { JalwaAdSlot } from "@/components/jalwa-ad-slot";
import { getCollections } from "@/lib/catalogue/repository";

export const metadata = { title: "Collections" };
export const dynamic = "force-dynamic";

export default async function CollectionsPage() {
  const collections = await getCollections();
  return (
    <div className="page-shell collections-page">
      <section className="collections-hero">
        <span className="eyebrow">Curated on Jalwa</span>
        <h1>Collections</h1>
        <p>Editorial sets built around useful stories, skills and entertainment. Premium collections unlock with an active Jalwa Premium subscription.</p>
      </section>
      <JalwaAdSlot placement="collections" />\n      {collections.length ? <div className="collections-grid">
        {collections.map((collection) => (
          <article className="collection-card" data-testid={collection.locked ? "premium-collection-locked" : "collection-card"} key={collection.slug}>
            <span className="eyebrow">{collection.accessLevel === "premium" ? "Premium collection" : "Collection"}</span>
            <h2>{collection.title}</h2>
            {collection.description ? <p>{collection.description}</p> : null}
            {collection.locked
              ? <Link className="button button-primary" href="/pricing">Unlock with Premium</Link>
              : <Link className="button button-secondary" href={`/collections/${collection.slug}`}>Open collection</Link>}
          </article>
        ))}
      </div> : <div className="empty-state"><h2>No published collections yet</h2><p>Curated collections will appear here after editorial publication.</p></div>}
    </div>
  );
}
