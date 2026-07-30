"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { SelfHostedPlayer } from "@/components/self-hosted-player";
import type { CatalogueItem } from "@/lib/catalogue/types";

function ShortCard({ item }: { item: CatalogueItem }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const node = ref.current;
    if (!node) return;
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
  }, []);

  return (
    <article className="short-card" ref={ref}>
      <div className="short-player"><SelfHostedPlayer contentId={item.id ?? ""} poster={item.thumbnailUrl} title={item.title} /></div>
      <div className="short-copy"><span className="eyebrow">{item.category}</span><h2>{item.title}</h2>{item.description ? <p>{item.description}</p> : null}<Link href={`/watch/${item.slug}`}>Open details</Link></div>
    </article>
  );
}

export function ShortsFeed({ items }: { items: CatalogueItem[] }) {
  return <div className="shorts-feed">{items.map((item) => <ShortCard item={item} key={item.id ?? item.slug} />)}</div>;
}
