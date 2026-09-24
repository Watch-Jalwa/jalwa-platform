import Link from "next/link";
import { notFound } from "next/navigation";
import { ContentCard } from "@/components/content-card";
import { getCollectionBySlug } from "@/lib/catalogue/repository";

type Params = Promise<{ slug: string }>;

export default async function CollectionPage({ params }: { params: Params }) {
  const { slug } = await params;
  const collection = await getCollectionBySlug(slug);
  if (!collection) notFound();
  return (
    <div className="page-shell collection-detail">
      <section className="collections-hero">
        <span className="eyebrow">{collection.accessLevel === "premium" ? "Premium collection" : "Collection"}</span>
        <h1>{collection.title}</h1>
        {collection.description ? <p>{collection.description}</p> : null}
      </section>
      {collection.locked ? (
        <section className="panel premium-collection-lock" data-testid="premium-collection-lock">
          <h2>Premium collection</h2>
          <p>This collection is available with Jalwa Premium. Collection membership is enforced on the server, not only hidden in the interface.</p>
          <Link className="button button-primary" href="/pricing">View Premium</Link>
        </section>
      ) : collection.items.length ? (
        <div className="content-grid" data-testid="premium-collection-content">
          {collection.items.map((item) => <ContentCard item={item} key={item.slug} />)}
        </div>
      ) : <div className="empty-state"><h2>No available titles</h2><p>Items will appear after their individual publication and rights gates pass.</p></div>}
    </div>
  );
}
