"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { SelfHostedPlayer } from "@/components/self-hosted-player";
import { lockedContentHref, lockedContentPrimaryLabel } from "@/lib/catalogue/locked-content-cta.mjs";
import type { CatalogueItem } from "@/lib/catalogue/types";

function ShortCard({ item }: { item: CatalogueItem }) {
  const ref = useRef<HTMLElement>(null);
  // Fail closed: only the free unlocked set (lockedForViewer === false) may embed.
  const playbackAllowed = item.lockedForViewer === false;
  const signedIn = Boolean(item.viewerSignedIn);
  const isYouTube = playbackAllowed && item.playback?.provider === "youtube" && item.playback.embedUrl;
  const lockedHref = lockedContentHref(item.slug, signedIn);
  const lockedLabel = lockedContentPrimaryLabel(signedIn);

  useEffect(() => {
    const node = ref.current;
    if (!node || isYouTube || !playbackAllowed) return;
    const observer = new IntersectionObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const video = node.querySelector("video");
      if (!video) return;
      if (entry.isIntersecting && entry.intersectionRatio > 0.75) void video.play().catch(() => undefined);
      else video.pause();
    }, { threshold: [0, 0.75, 1] });
    observer.observe(node);
    return () => observer.disconnect();
  }, [isYouTube, playbackAllowed]);

  return (
    <article className={`short-card${playbackAllowed ? "" : " short-card-locked"}`} ref={ref}>
      <div className="short-player">
        {!playbackAllowed ? (
          <div className="player-placeholder">
            <span className="eyebrow">{signedIn ? "Premium" : "Sign in"}</span>
            <p>
              {signedIn
                ? "Free accounts can watch 10 videos. Subscribe to unlock more Shorts."
                : "Sign in to watch. Premium unlocks videos beyond the free 10."}
            </p>
            <Link className="button button-primary" href={lockedHref}>
              {lockedLabel}
            </Link>
          </div>
        ) : isYouTube ? (
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            loading="lazy"
            referrerPolicy="strict-origin-when-cross-origin"
            src={item.playback?.embedUrl ?? undefined}
            title={item.title}
          />
        ) : item.id ? (
          <SelfHostedPlayer contentId={item.id} poster={item.thumbnailUrl} title={item.title} />
        ) : (
          <div className="player-placeholder"><p>Playback is not available for this preview item.</p></div>
        )}
      </div>
      <div className="short-copy">
        <span className="eyebrow">{playbackAllowed ? item.category : (signedIn ? "Premium" : "Sign in")}</span>
        <h2>{item.title}</h2>
        {item.description ? <p>{item.description}</p> : null}
        <Link href={playbackAllowed ? `/watch/${item.slug}` : lockedHref}>
          {playbackAllowed ? "Open details" : (signedIn ? "Unlock with Premium" : "Sign in to watch")}
        </Link>
      </div>
    </article>
  );
}

export function ShortsFeed({ items }: { items: CatalogueItem[] }) {
  return <div className="shorts-feed">{items.map((item) => <ShortCard item={item} key={item.id ?? item.slug} />)}</div>;
}
