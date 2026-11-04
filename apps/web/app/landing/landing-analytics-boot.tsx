"use client";

import { useEffect } from "react";
import { stampUtmAttribution } from "@/lib/utm-attribution.mjs";
import { attributionForBilling } from "@/lib/landing-campaign.mjs";

export function LandingAnalyticsBoot({ campaign }: { campaign: Record<string, string | undefined> & { planCode: string; landing: string; landingPath: string } }) {
  useEffect(() => {
    stampUtmAttribution(attributionForBilling(campaign as never));
    if (typeof window !== "undefined" && typeof window.gtag === "function") {
      window.gtag("event", "landing_view", {
        landing: campaign.landing,
        utm: campaign.utm,
        package: campaign.package,
        parameter: campaign.parameter,
      });
      window.gtag("event", "view_item", { item_id: campaign.planCode, landing: campaign.landing });
    }
  }, [campaign]);

  return null;
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}
