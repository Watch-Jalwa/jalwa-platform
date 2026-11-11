"use client";

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
          <h2 id="trending-title" className="trending-title">
            Trending on <span>Jalwa</span>
          </h2>
          <p>Discover what Pakistan is watching right now.</p>
        </div>
        <div className="trending-nav" aria-label="Trending carousel controls">
          <button type="button" className="trending-nav-btn" aria-label="Previous" onClick={() => scrollByCard(-1)}>
            ‹
          </button>
          <button type="button" className="trending-nav-btn is-next" aria-label="Next" onClick={() => scrollByCard(1)}>
            ›
          </button>
        </div>
      </div>
      <div className="trending-scroller" ref={scrollerRef} tabIndex={0} aria-label="Trending videos">
        {children}
      </div>
    </div>
  );
}
