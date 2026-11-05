import Link from "next/link";
import { formatDuration } from "@/lib/catalogue/demo-data";
import { isGatedVideoType } from "@/lib/catalogue/free-tier-access-core.mjs";
import type { CatalogueItem } from "@/lib/catalogue/types";

export function ContentCard({ item }: { item: CatalogueItem }) {
  const gatedVideo = isGatedVideoType(item.contentType);
  const locked = gatedVideo && (Boolean(item.lockedForViewer) || item.accessLevel === "premium");
  const badge = locked
    ? "Premium"
    : gatedVideo
      ? "Free"
      : item.contentType === "live"
        ? "Live"
        : item.contentType === "short"
          ? "Free"
          : String(item.contentType || "Open");
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
