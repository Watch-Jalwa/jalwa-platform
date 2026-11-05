import Link from "next/link";
import { formatDuration } from "@/lib/catalogue/demo-data";
import type { CatalogueItem } from "@/lib/catalogue/types";

export function ContentCard({ item }: { item: CatalogueItem }) {
  const locked = Boolean(item.lockedForViewer) || item.accessLevel === "premium";
  const badge = locked ? "Premium" : "Free";
  return (
    <article className={`content-card${locked ? " content-card-locked" : ""}`}>
      <Link href={locked ? `/pricing?next=${encodeURIComponent(`/watch/${item.slug}`)}` : `/watch/${item.slug}`}>
        <div
          className="content-art"
          style={item.thumbnailUrl ? { backgroundImage: `linear-gradient(180deg,transparent,rgba(0,0,0,.82)),url(${item.thumbnailUrl})` } : undefined}
        >
          <span>{badge}</span>
        </div>
        <h3>{item.title}</h3>
        <p>{item.category} · {formatDuration(item.durationSeconds)}</p>
      </Link>
    </article>
  );
}
