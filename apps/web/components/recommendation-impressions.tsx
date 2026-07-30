"use client";

import { useEffect } from "react";

export function RecommendationImpressions({ contentIds, placement }: { contentIds: string[]; placement: string }) {
  useEffect(() => {
    const valid = contentIds.filter(Boolean);
    if (!valid.length) return;
    let sessionId = sessionStorage.getItem("jalwa_recommendation_session");
    if (!sessionId) { sessionId = crypto.randomUUID(); sessionStorage.setItem("jalwa_recommendation_session", sessionId); }
    const sent = new Set<string>();
    const observers: IntersectionObserver[] = [];
    for (const contentId of valid) {
      const element = document.querySelector<HTMLElement>(`[data-recommendation-id="${CSS.escape(contentId)}"]`);
      if (!element) continue;
      const observer = new IntersectionObserver((entries) => {
        if (!entries.some((entry) => entry.isIntersecting && entry.intersectionRatio >= .5) || sent.has(contentId)) return;
        sent.add(contentId);
        void fetch("/api/recommendations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentId, eventType: "impression", sessionId, context: { placement } }), keepalive: true }).catch(() => undefined);
        observer.disconnect();
      }, { threshold: .5 });
      observer.observe(element); observers.push(observer);
    }
    return () => observers.forEach((observer) => observer.disconnect());
  }, [contentIds, placement]);
  return null;
}
