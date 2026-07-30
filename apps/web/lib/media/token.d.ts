export type PlaybackTokenPayload = { assetId: string; pathPrefix: string; userId?: string | null; deviceId?: string | null; exp?: number };
export function signPlaybackToken(payload: PlaybackTokenPayload, secret: string, ttlSeconds?: number): string;
export function verifyPlaybackToken(token: string, secret: string, nowSeconds?: number): PlaybackTokenPayload | null;
