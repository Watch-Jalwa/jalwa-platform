import type { Metadata } from "next";
import { LandingShell } from "@/app/landing/landing-shell";
import { normalizeDefaultLandingCampaign } from "@/lib/landing-campaign.mjs";
import "@/app/landing/landing.css";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const campaign = normalizeDefaultLandingCampaign(await searchParams);
  const canonical = `/?${campaign.queryString}`;
  return {
    title: "Jalwa — Scroll se aagay. Jalwa dekho.",
    description: "Kahaniyan aur entertainment, aik jagah. JazzCash se Subscribe Now.",
    alternates: { canonical },
    openGraph: {
      title: "Jalwa — Scroll se aagay. Jalwa dekho.",
      description: "Kahaniyan aur entertainment, aik jagah.",
      url: canonical,
    },
  };
}

export default async function HomePage({ searchParams }: { searchParams: SearchParams }) {
  const campaign = normalizeDefaultLandingCampaign(await searchParams);
  return (
    <LandingShell
      campaign={campaign}
      h1="Jalwa — Scroll se aagay. Jalwa dekho. Kahaniyan aur entertainment, aik jagah."
      webBannerSrc="/landing/default-web-banner.jpeg"
      mobileBannerSrc="/landing/default-mobile-banner.jpeg"
      offerNotice="JazzCash number se Subscribe Now. Sign in later with the same number."
      ctaHref="/explore"
      ctaLabel="Watch Now"
      subscribeCta="Subscribe Now"
    />
  );
}
