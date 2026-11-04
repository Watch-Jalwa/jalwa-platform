import type { Metadata } from "next";
import { LandingShell } from "@/app/landing/landing-shell";
import { normalizeLanding1Campaign } from "@/lib/landing-campaign.mjs";
import "@/app/landing/landing.css";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const campaign = normalizeLanding1Campaign(await searchParams);
  const canonical = `/landing1?${campaign.queryString}`;
  return {
    title: "Jalwa × JazzCash — 10,000 credits every month",
    description: "Jalwa dekho. Jeetne ka mauqa pao. Monthly JazzCash credits with Premium.",
    alternates: { canonical },
    openGraph: {
      title: "Win 10,000 JazzCash credits every month",
      description: "Jalwa dekho. Jeetne ka mauqa pao.",
      url: canonical,
    },
  };
}

export default async function Landing1Page({ searchParams }: { searchParams: SearchParams }) {
  const campaign = normalizeLanding1Campaign(await searchParams);
  return (
    <LandingShell
      campaign={campaign}
      h1="Jalwa × JazzCash — 10,000 credits every month. Jalwa dekho. Jeetne ka mauqa pao."
      webBannerSrc="/landing/tiktok-web-banner.jpeg"
      mobileBannerSrc="/landing/tiktok-mobile-banner.jpeg"
      offerNotice="Monthly 10,000 JazzCash credits chance with Premium. Terms apply."
      ctaHref={`/explore?${campaign.queryString}`}
      ctaLabel="Explore Jalwa"
      subscribeCta="Explore Jalwa"
      showJazzcashReward
    />
  );
}
