import type { CatalogueCategory, CatalogueItem } from "./types";

export const categories: CatalogueCategory[] = [
  { slug: "originals", label: "Jalwa Originals", urdu: "جلوہ اوریجنلز", icon: "✦" },
  { slug: "shorts", label: "Shorts", urdu: "شارٹس", icon: "▯" },
  { slug: "entertainment", label: "Entertainment", urdu: "تفریح", icon: "▶" },
  { slug: "deen", label: "Deen", urdu: "دین", icon: "☾" },
  { slug: "kissan", label: "Kissan & Farming", urdu: "کسان اور زراعت", icon: "🌾" },
  { slug: "learn", label: "Learn", urdu: "سیکھیں", icon: "◫" },
  { slug: "tech", label: "Tech & AI", urdu: "ٹیکنالوجی", icon: "⌁" },
  { slug: "rozgar", label: "Rozgar", urdu: "روزگار", icon: "↗" },
  { slug: "pakistan", label: "Pakistan", urdu: "پاکستان", icon: "◆" },
  { slug: "kids", label: "Kids & Family", urdu: "بچے اور خاندان", icon: "✿" },
  { slug: "life", label: "Health & Life", urdu: "صحت اور زندگی", icon: "♡" },
  { slug: "live", label: "Live", urdu: "براہ راست", icon: "●" },
];

function youtubePlayback(videoId: string, range?: { start: number; end: number }) {
  const rangeQuery = range ? `&start=${range.start}&end=${range.end}` : "";
  return {
    provider: "youtube",
    providerContentId: videoId,
    embedUrl: `https://www.youtube-nocookie.com/embed/${videoId}?rel=0${rangeQuery}`,
    externalUrl: `https://www.youtube.com/watch?v=${videoId}`,
    format: "youtube" as const,
  };
}

function youtubeThumbnail(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

export const featuredContent: CatalogueItem[] = [
  {
    slug: "embedded-player-showcase",
    title: "Embedded video player showcase",
    titleUrdu: "ویڈیو پلیئر کا نمونہ",
    description: "A temporary playable video used to review Jalwa's responsive watch experience.",
    category: "Tech & AI",
    categorySlug: "tech",
    durationSeconds: 135,
    accessLevel: "public",
    contentType: "video",
    hostingMode: "embed_only",
    thumbnailUrl: youtubeThumbnail("M7lc1UVf-VE"),
    playback: youtubePlayback("M7lc1UVf-VE"),
    sourceUrl: "https://www.youtube.com/watch?v=M7lc1UVf-VE",
    attribution: "Temporary preview embed supplied through the official YouTube player.",
  },
  {
    slug: "neural-network-visual-introduction",
    title: "But what is a neural network?",
    titleUrdu: "نیورل نیٹ ورک کیا ہے؟",
    description: "A visual introduction to neural networks by 3Blue1Brown, embedded for frontend review.",
    category: "Tech & AI",
    categorySlug: "tech",
    durationSeconds: 1160,
    accessLevel: "public",
    contentType: "video",
    hostingMode: "embed_only",
    thumbnailUrl: youtubeThumbnail("aircAruvnKk"),
    playback: youtubePlayback("aircAruvnKk"),
    sourceUrl: "https://www.youtube.com/watch?v=aircAruvnKk",
    attribution: "Embedded from the original 3Blue1Brown YouTube source for preview purposes.",
  },
  {
    slug: "big-buck-bunny-open-movie",
    title: "Big Buck Bunny — open movie",
    description: "An open-movie playback sample used to review entertainment layouts and fullscreen video.",
    category: "Entertainment",
    categorySlug: "entertainment",
    durationSeconds: 596,
    accessLevel: "public",
    contentType: "video",
    hostingMode: "embed_only",
    thumbnailUrl: youtubeThumbnail("aqz-KE-bpKQ"),
    playback: youtubePlayback("aqz-KE-bpKQ"),
    sourceUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
    attribution: "Big Buck Bunny is a Blender Foundation open movie; this preview uses a YouTube embed.",
  },
  {
    slug: "one-minute-open-movie-preview",
    title: "One-minute open-movie preview",
    titleUrdu: "ایک منٹ کی ویڈیو",
    description: "A short-form playback sample for testing the swipeable Shorts experience.",
    category: "Shorts",
    categorySlug: "shorts",
    durationSeconds: 60,
    accessLevel: "public",
    contentType: "short",
    hostingMode: "embed_only",
    thumbnailUrl: youtubeThumbnail("aqz-KE-bpKQ"),
    playback: youtubePlayback("aqz-KE-bpKQ", { start: 60, end: 120 }),
    sourceUrl: "https://www.youtube.com/watch?v=aqz-KE-bpKQ",
    attribution: "Temporary short-form preview using the Blender Foundation open movie embed.",
  },
  {
    slug: "neural-network-quick-look",
    title: "Neural networks: quick visual look",
    description: "A second short-form item so scrolling and snap navigation can be reviewed.",
    category: "Shorts",
    categorySlug: "shorts",
    durationSeconds: 90,
    accessLevel: "public",
    contentType: "short",
    hostingMode: "embed_only",
    thumbnailUrl: youtubeThumbnail("aircAruvnKk"),
    playback: youtubePlayback("aircAruvnKk", { start: 0, end: 90 }),
    sourceUrl: "https://www.youtube.com/watch?v=aircAruvnKk",
    attribution: "Temporary preview excerpt embedded from the original 3Blue1Brown YouTube source.",
  },
];

export function formatDuration(seconds?: number | null) {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes} min`;
}
