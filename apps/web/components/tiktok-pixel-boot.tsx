"use client";

import { useEffect } from "react";
import { ensureTikTokPixel } from "@/lib/tiktok-pixel.mjs";
import { campaignConsentGranted } from "@/lib/campaign-client.mjs";

/** Site-wide TikTok Pixel base load + PageView (needed for payment return on `/`). */
export function TikTokPixelBoot() {
  useEffect(() => {
    const enable=()=>{if(campaignConsentGranted())ensureTikTokPixel();
      else if(typeof (window as unknown as {ttq?:{revokeConsent?:()=>void}}).ttq?.revokeConsent==="function"){
        try{(window as unknown as {ttq:{revokeConsent:()=>void}}).ttq.revokeConsent();}catch{/* marketing only */}
      }};
    enable();
    window.addEventListener("jalwa-campaign-consent",enable);
    return ()=>window.removeEventListener("jalwa-campaign-consent",enable);
  }, []);
  return null;
}
