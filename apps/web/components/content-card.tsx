import Link from "next/link";
import { formatDuration } from "@/lib/catalogue/demo-data";
import { isGatedVideoType } from "@/lib/catalogue/free-tier-access.mjs";
import type { CatalogueItem } from "@/lib/catalogue/types";

export function ContentCard({ item }: { item: CatalogueItem }) {
  const gatedVideo = isGatedVideoType(item.contentType);
  // Fail closed: only the free unlocked set (lockedForViewer === false) plays without Premium.
  const locked = gatedVideo && item.lockedForViewer !== false;
  const badge = locked
    ? "Premium"
    : gatedVideo
      ? "Free"
      : item.contentType === "live"
        ? "Live"
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
