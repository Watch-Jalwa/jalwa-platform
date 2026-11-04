"use client";

import { useEffect } from "react";
import { stampUtmAttribution } from "@/lib/utm-attribution.mjs";

type Props = {
  landing: string;
  landingPath: string;
  planCode: string;
  utm: string;
  packageCode: string;
  parameter: string;
  payment: string;
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  refCode?: string;
  he?: string;
};

export function LandingAnalyticsBoot(props: Props) {
  useEffect(() => {
    stampUtmAttribution({
      utm: props.utm,
      utm_source: props.utmSource ?? props.utm,
      utm_medium: props.utmMedium,
      utm_campaign: props.utmCampaign,
      utm_content: props.utmContent,
      package: props.packageCode,
      parameter: props.parameter,
      payment: props.payment,
      ref: props.refCode,
      landing: props.landing,
      landingPath: props.landingPath,
      he: props.he,
    });

    if (typeof window.gtag === "function") {
      window.gtag("event", "landing_view", {
        landing: props.landing,
        utm: props.utm,
        package: props.packageCode,
        parameter: props.parameter,
      });
      window.gtag("event", "view_item", { item_id: props.planCode, landing: props.landing });
    }
  }, [props]);

  return null;
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}
