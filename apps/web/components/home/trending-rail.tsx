import Link from "next/link";
import { formatDuration } from "@/lib/catalogue/demo-data";
import { isGatedVideoType } from "@/lib/catalogue/free-tier-access.mjs";
import { lockedContentBadge, lockedContentHref } from "@/lib/catalogue/locked-content-cta.mjs";
import type { CatalogueItem } from "@/lib/catalogue/types";
import { TrendingScroller } from "./trending-scroller";

export function TrendingRail({ items }: { items: CatalogueItem[] }) {
  if (!items.length) {
    return <div className="empty-state">Trending titles will appear after publishing.</div>;
  }

  return (
    <TrendingScroller>
      {items.map((item, index) => {
        const gatedVideo = isGatedVideoType(item.contentType);
        const locked = gatedVideo && item.lockedForViewer !== false;
        const signedIn = Boolean(item.viewerSignedIn);
        const href = locked ? lockedContentHref(item.slug, signedIn) : `/watch/${item.slug}`;
        const badge = index === 0 ? "Jalwa Original" : null;
        return (
          <article className={`trending-card${index === 0 ? " is-featured" : ""}`} key={item.slug} data-reveal="up">
            <Link href={href}>
              <div
                className="trending-art"
                style={
                  item.thumbnailUrl
                    ? {
                        backgroundImage: `linear-gradient(180deg,transparent 35%,rgba(8,4,16,.92)),url("${item.thumbnailUrl}")`,
                      }
                    : undefined
                }
              >
                {badge ? (
                  <span className="trending-original">
                    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                      <path fill="currentColor" d="M8 1.5l1.8 3.7 4.1.6-3 2.9.7 4.1L8 11.2 4.4 13l.7-4.1-3-2.9 4.1-.6z" />
                    </svg>
                    {badge}
                  </span>
                ) : null}
                <span className="trending-play" aria-hidden="true" />
                <div className="trending-meta">
                  <h3>{item.title}</h3>
                  <p>
                    {item.category} · {formatDuration(item.durationSeconds)}
                    {locked ? ` · ${lockedContentBadge(signedIn)}` : ""}
                  </p>
                </div>
              </div>
            </Link>
          </article>
        );
      })}
    </TrendingScroller>
  );
}
