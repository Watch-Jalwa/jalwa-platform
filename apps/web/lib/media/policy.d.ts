export type MediaPipeline = "short_mp4" | "hls";
export function validateMediaUpload(input: { mimeType: string; sizeBytes: number }): { ok: boolean; error?: string };
export function selectPipeline(input: { contentType: string; durationSeconds?: number | null }): MediaPipeline;
export function safeMediaExtension(filename: string): string;
