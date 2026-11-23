import { JALWA_TIKTOK_PIXEL_DEFAULT, JALWA_TIKTOK_PIXEL_META } from "@/lib/tiktok-pixel.mjs";

/**
 * Runtime-configurable TikTok Pixel ID via meta tag.
 * Prefer TIKTOK_PIXEL_ID (server/runtime) so container deploys can change ID without rebuild.
 */
export function TikTokRuntimeConfig() {
  const pixelId =
    String(process.env.TIKTOK_PIXEL_ID ?? process.env.NEXT_PUBLIC_TIKTOK_PIXEL_ID ?? "").trim() ||
    JALWA_TIKTOK_PIXEL_DEFAULT;
  if (!pixelId) return null;
  return <meta name={JALWA_TIKTOK_PIXEL_META} content={pixelId} />;
}
