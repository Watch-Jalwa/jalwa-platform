"use client";

import { useEffect } from "react";
import { trackLandingView } from "@/lib/landing-analytics.mjs";
import { stampUtmAttribution } from "@/lib/utm-attribution.mjs";
import { captureCampaignEvent, campaignConsentGranted } from "@/lib/campaign-client.mjs";

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

    captureCampaignEvent("landing_view", {
      landingPath:props.landingPath, utm:props.utm, utm_source:props.utmSource,
      utm_medium:props.utmMedium,utm_campaign:props.utmCampaign,
      utm_content:props.utmContent,package:props.packageCode,
      parameter:props.parameter,ref:props.refCode,planCode:props.planCode,
    });
    if (campaignConsentGranted() && typeof window.gtag === "function") {
      window.gtag("event", "landing_view", {
        landing: props.landing,
        utm: props.utm,
        package: props.packageCode,
        parameter: props.parameter,
      });
      window.gtag("event", "view_item", { item_id: props.planCode, landing: props.landing });
    }

    if (campaignConsentGranted()) trackLandingView({
      landing: props.landing,
      landingPath: props.landingPath,
      planCode: props.planCode,
      utm: props.utm,
      packageCode: props.packageCode,
      parameter: props.parameter,
      payment: props.payment,
    });
  }, [props]);

  return null;
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}
