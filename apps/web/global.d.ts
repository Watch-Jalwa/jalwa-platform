declare module "@/lib/youtube/parse.mjs" {
  export function parseYouTubeVideoId(value: string): string | null;
  export function canonicalYouTubeUrl(videoId: string): string;
}
