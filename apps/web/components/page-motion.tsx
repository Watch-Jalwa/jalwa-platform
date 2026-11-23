"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

const SELECTORS = [
  ".page-shell > section",
  ".page-shell > header",
  ".page-shell > aside",
  ".page-shell > .section-heading",
  ".page-shell > form",
  ".page-shell > nav",
  ".page-shell > .search-bar",
  ".page-shell > .result-summary",
  ".page-shell > .empty-state",
  ".page-shell > .content-grid > *",
  ".page-shell > .pricing-grid > *",
  ".page-shell > .ask-grid > *",
  ".page-shell > .live-grid > *",
  ".page-shell > .recommendation-section",
  ".page-shell > .player-shell",
  ".page-shell > .watch-copy",
  ".page-shell > .panel",
  ".home-mfp",
  ".home-trending",
  ".home-promo-grid > *",
  ".home-banner-hero",
  ".tamasha-premium-banner",
  ".category-tile",
  ".trending-card",
  ".content-card",
  ".recommendation-card",
  ".live-card",
  ".price-card",
  ".premium-benefit-card",
  ".for-you-hero",
  ".live-hero",
  ".pricing-hero",
  ".ask-hero",
  ".ask-panel",
  ".answer-panel",
  ".policy-header",
  ".form-shell",
  ".panel",
  ".section-heading",
  ".auth-journey > *",
  ".support-page > *",
  ".premium-hub > section",
  ".live-page > section",
  ".live-page > aside",
  ".for-you-page > *",
  ".watch-layout > *",
  ".billing-page > section",
  ".billing-page > .panel",
  ".onboarding-page > *",
  ".profile-page > section",
  ".profile-page > .panel",
  ".viewer-page > *",
  ".policy-page > *",
];

const SKIP_CLOSEST =
  "header.site-header, .site-header, .desktop-nav, .mobile-nav, footer, [data-reveal-skip], .feed, video, .drm-player-stack";

function prefersReducedMotion() {
  return (
    window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
    document.documentElement.classList.contains("reduce-motion")
  );
}

function tagTargets(root: ParentNode = document) {
  const nodes = Array.from(root.querySelectorAll(SELECTORS.join(",")));
  nodes.forEach((el, index) => {
    if (!(el instanceof HTMLElement)) return;
    if (el.closest(SKIP_CLOSEST)) return;
    if (el.matches(SKIP_CLOSEST)) return;
    if (!el.hasAttribute("data-reveal")) el.setAttribute("data-reveal", "up");
    if (!el.style.getPropertyValue("--reveal-delay")) {
      el.style.setProperty("--reveal-delay", `${Math.min(index % 8, 7) * 55}ms`);
    }
  });
}

function revealInView(targets: HTMLElement[], observer: IntersectionObserver | null) {
  const viewport = window.innerHeight * 0.94;
  targets.forEach((el) => {
    if (el.classList.contains("is-revealed")) return;
    const rect = el.getBoundingClientRect();
    if (rect.top < viewport && rect.bottom > 0) {
      el.classList.add("is-revealed");
      return;
    }
    observer?.observe(el);
  });
}

/**
 * JobUp-style scroll reveals (AOS-like) across consumer pages.
 * Auto-tags common blocks and re-binds after client navigations.
 */
export function PageMotion() {
  const pathname = usePathname();

  useEffect(() => {
    let observer: IntersectionObserver | null = null;
    let mutation: MutationObserver | null = null;
    let cancelled = false;
    const timers: number[] = [];

    const bind = () => {
      if (cancelled) return;
      tagTargets(document);

      const targets = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
      if (prefersReducedMotion()) {
        targets.forEach((el) => el.classList.add("is-revealed"));
        return;
      }

      if (!observer) {
        observer = new IntersectionObserver(
          (entries) => {
            for (const entry of entries) {
              if (!entry.isIntersecting) continue;
              entry.target.classList.add("is-revealed");
              observer?.unobserve(entry.target);
            }
          },
          { threshold: 0.1, rootMargin: "40px 0px -6% 0px" },
        );
      }

      revealInView(targets, observer);
    };

    // Next App Router paints after the pathname effect; bind a few times + watch mutations briefly.
    bind();
    requestAnimationFrame(() => {
      bind();
      requestAnimationFrame(bind);
    });
    timers.push(window.setTimeout(bind, 120));
    timers.push(window.setTimeout(bind, 400));

    let debounceId = 0;
    mutation = new MutationObserver(() => {
      if (cancelled) return;
      window.clearTimeout(debounceId);
      debounceId = window.setTimeout(bind, 50);
    });
    mutation.observe(document.body, { childList: true, subtree: true });
    timers.push(
      window.setTimeout(() => {
        mutation?.disconnect();
        mutation = null;
        window.clearTimeout(debounceId);
      }, 2500),
    );

    return () => {
      cancelled = true;
      timers.forEach((id) => window.clearTimeout(id));
      mutation?.disconnect();
      observer?.disconnect();
    };
  }, [pathname]);

  return null;
}
