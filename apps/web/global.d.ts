declare module "@/lib/youtube/parse.mjs" {
  export function parseYouTubeVideoId(value: string): string | null;
  export function canonicalYouTubeUrl(videoId: string): string;
}

declare module "@/lib/media/policy.mjs" {
  export type MediaPipeline = "short_mp4" | "hls";
  export function validateMediaUpload(input: { mimeType: string; sizeBytes: number }): { ok: boolean; error?: string };
  export function selectPipeline(input: { contentType: string; durationSeconds?: number | null }): MediaPipeline;
  export function safeMediaExtension(filename: string): string;
}

declare module "@/lib/media/token.mjs" {
  export type PlaybackTokenPayload = { assetId: string; pathPrefix: string; userId?: string | null; exp?: number };
  export function signPlaybackToken(payload: PlaybackTokenPayload, secret: string, ttlSeconds?: number): string;
  export function verifyPlaybackToken(token: string, secret: string, nowSeconds?: number): PlaybackTokenPayload | null;
}

declare module "@/lib/payments/signature.mjs" {
  export function signPaymentPayload(payload: string, secret: string): string;
  export function verifyPaymentSignature(payload: string, signature: string | null | undefined, secret: string): boolean;
}
