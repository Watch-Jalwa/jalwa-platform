export const JALWA_TIKTOK_PIXEL_META: string;
export const JALWA_TIKTOK_PIXEL_DEFAULT: string;

export function resolveTikTokPixelId(override?: string | null): string;
export function ensureTikTokPixel(pixelIdOverride?: string | null): string | null;
export function wasTikTokConversionFired(eventName: string, eventId: string): boolean;
export function markTikTokConversionFired(eventName: string, eventId: string): void;
export function logTikTokEvent(
  eventName: string,
  payload?: Record<string, unknown>,
  options?: { event_id?: string; pixelId?: string },
): boolean;
export function __resetTikTokPixelForTests(): void;
