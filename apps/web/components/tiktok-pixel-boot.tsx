"use client";

import { useEffect } from "react";
import { ensureTikTokPixel } from "@/lib/tiktok-pixel.mjs";

/** Site-wide TikTok Pixel base load + PageView (needed for payment return on `/`). */
export function TikTokPixelBoot() {
  useEffect(() => {
    ensureTikTokPixel();
  }, []);
  return null;
}
