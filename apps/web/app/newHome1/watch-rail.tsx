"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useRef, useState } from "react";

type WatchRailProps = {
  children: ReactNode;
};

export function WatchRail({ children }: WatchRailProps) {
  const railRef = useRef<HTMLDivElement>(null);
  const [canGoBack, setCanGoBack] = useState(false);
  const [canGoForward, setCanGoForward] = useState(true);

  function updateButtons() {
    const rail = railRef.current;
    if (!rail) return;
    setCanGoBack(rail.scrollLeft > 2);
    setCanGoForward(rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 2);
  }

  function move(direction: -1 | 1) {
    const rail = railRef.current;
    if (!rail) return;
    const card = rail.querySelector<HTMLElement>(".new-home-video-card");
    const step = card ? card.getBoundingClientRect().width + 12 : rail.clientWidth;
    rail.scrollBy({ left: direction * step, behavior: "smooth" });
    window.setTimeout(updateButtons, 350);
  }

  return (
    <>
      <div className="new-home-watch-controls">
        <Link href="/explore" className="new-home-small-button">View All <span aria-hidden="true">→</span></Link>
        <button className="new-home-rail-button" type="button" aria-label="Previous videos" onClick={() => move(-1)} disabled={!canGoBack}>‹</button>
        <button className="new-home-rail-button new-home-rail-next" type="button" aria-label="Next videos" onClick={() => move(1)} disabled={!canGoForward}>›</button>
      </div>
      <div className="new-home-rail" ref={railRef} onScroll={updateButtons}>
        {children}
      </div>
    </>
  );
}
