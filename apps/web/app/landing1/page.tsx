import type { Metadata } from "next";
import { LandingShell } from "@/app/landing/landing-shell";
import { landing1Creative, normalizeLanding1Campaign } from "@/lib/landing-campaign.mjs";
import "@/app/landing/landing.css";

export const dynamic = "force-dynamic";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({ searchParams }: { searchParams: SearchParams }): Promise<Metadata> {
  const campaign = normalizeLanding1Campaign(await searchParams);
  const creative = landing1Creative(campaign.parameter);
  const canonical = `/landing1?${campaign.queryString}`;
  return {
    title: creative.title,
    description: creative.description,
    alternates: { canonical },
    openGraph: {
      title: creative.ogTitle,
      description: creative.ogDescription,
      url: canonical,
    },
  };
}

export default async function Landing1Page({ searchParams }: { searchParams: SearchParams }) {
  const campaign = normalizeLanding1Campaign(await searchParams);
  const creative = landing1Creative(campaign.parameter);
  return (
    <LandingShell
      campaign={campaign}
      h1={creative.h1}
      webBannerSrc={creative.webBannerSrc}
      mobileBannerSrc={creative.mobileBannerSrc}
      imageAlt={creative.imageAlt}
      offerNotice={creative.offerNotice}
      ctaHref={`/explore?${campaign.queryString}`}
      subscribeCta="Explore Jalwa"
    />
  );
}
