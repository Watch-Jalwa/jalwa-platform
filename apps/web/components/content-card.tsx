import Link from "next/link";
import { formatDuration } from "@/lib/catalogue/demo-data";
import type { CatalogueItem } from "@/lib/catalogue/types";

export function ContentCard({ item }: { item: CatalogueItem }) {
  const premium = item.accessLevel === "premium";
  return (
    <article className="content-card">
      <Link href={`/watch/${item.slug}`}>
        <div
          className="content-art"
          style={item.thumbnailUrl ? { backgroundImage: `linear-gradient(180deg,transparent,rgba(0,0,0,.82)),url(${item.thumbnailUrl})` } : undefined}
        >
          <span>{premium ? "Premium" : "Free"}</span>
        </div>
        <h3>{item.title}</h3>
        <p>{item.category} · {formatDuration(item.durationSeconds)}</p>
      </Link>
    </article>
  );
}
