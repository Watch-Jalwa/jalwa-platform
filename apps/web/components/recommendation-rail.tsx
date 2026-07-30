import Link from "next/link";
import { formatDuration } from "@/lib/catalogue/demo-data";
import type { RecommendedItem } from "@/lib/recommendations/repository";
import { RecommendationImpressions } from "@/components/recommendation-impressions";

export function RecommendationRail({ items, title = "Recommended for you", placement = "rail" }: { items: RecommendedItem[]; title?: string; placement?: string }) {
  if (!items.length) return null;
  return <section className="recommendation-section">
    <div className="section-heading"><div><span className="eyebrow">Personalized discovery</span><h2>{title}</h2></div><Link href="/for-you">See all</Link></div>
    <div className="recommendation-grid">
      {items.map((item) => <article className="recommendation-card" data-recommendation-id={item.id} key={item.id ?? item.slug}>
        <Link href={`/watch/${item.slug}`}>
          <div className="recommendation-art" style={item.thumbnailUrl ? { backgroundImage: `linear-gradient(180deg,transparent,rgba(0,0,0,.85)),url(${item.thumbnailUrl})` } : undefined}><span>{item.accessLevel === "premium" ? "Premium" : item.category}</span></div>
          <h3>{item.title}</h3>
          <p>{formatDuration(item.durationSeconds)} · {item.recommendationReason ?? "Selected for you"}</p>
        </Link>
      </article>)}
    </div>
    <RecommendationImpressions contentIds={items.map((item) => item.id).filter((id): id is string => Boolean(id))} placement={placement} />
  </section>;
}
