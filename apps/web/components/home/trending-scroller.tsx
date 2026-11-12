"use client";

import Link from "next/link";
import { useRef, type ReactNode } from "react";

export function TrendingScroller({ children }: { children: ReactNode }) {
  const scrollerRef = useRef<HTMLDivElement>(null);

  function scrollByCard(direction: -1 | 1) {
    const node = scrollerRef.current;
    if (!node) return;
    const amount = Math.min(360, node.clientWidth * 0.85) * direction;
    node.scrollBy({ left: amount, behavior: "smooth" });
  }

  return (
    <div className="trending-rail">
      <div className="trending-rail-head">
        <div>
          <div className="trending-heading">
            <span className="trending-heading-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24">
                <path d="M5 16l5-5 3 3 6-7" />
                <path d="M14 7h5v5" />
              </svg>
            </span>
            <h2 id="trending-title" className="trending-title">
              Trending on <span>Jalwa</span>
            </h2>
          </div>
          <p>Discover what Pakistan is watching right now.</p>
        </div>
        <div className="trending-actions">
          <Link className="trending-view-all" href="/explore">
            View All <span aria-hidden="true">→</span>
          </Link>
          <div className="trending-nav" aria-label="Trending carousel controls">
            <button type="button" className="trending-nav-btn" aria-label="Previous" onClick={() => scrollByCard(-1)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m14.5 5-7 7 7 7" />
              </svg>
            </button>
            <button type="button" className="trending-nav-btn is-next" aria-label="Next" onClick={() => scrollByCard(1)}>
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="m9.5 5 7 7-7 7" />
              </svg>
            </button>
          </div>
        </div>
      </div>
      <div className="trending-scroller" ref={scrollerRef} tabIndex={0} aria-label="Trending videos">
        {children}
      </div>
    </div>
  );
}
