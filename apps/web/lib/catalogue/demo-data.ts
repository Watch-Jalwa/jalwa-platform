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

export const featuredContent: CatalogueItem[] = [
  {
    slug: "water-smart-farming",
    title: "Water-smart farming basics",
    titleUrdu: "پانی کی بچت والی زراعت",
    description: "Practical water-saving principles for Pakistani farms.",
    category: "Kissan & Farming",
    categorySlug: "kissan",
    durationSeconds: 240,
    accessLevel: "public",
    contentType: "video",
    hostingMode: "self_host_owned",
  },
  {
    slug: "ai-in-simple-urdu",
    title: "AI explained in simple Urdu",
    titleUrdu: "آسان اردو میں اے آئی",
    description: "A beginner-friendly introduction to artificial intelligence.",
    category: "Tech & AI",
    categorySlug: "tech",
    durationSeconds: 360,
    accessLevel: "public",
    contentType: "video",
    hostingMode: "self_host_owned",
  },
  {
    slug: "one-minute-seerah",
    title: "One Minute Seerah",
    titleUrdu: "ایک منٹ سیرت",
    description: "A short, reviewed Seerah learning format.",
    category: "Deen",
    categorySlug: "deen",
    durationSeconds: 60,
    accessLevel: "public",
    contentType: "short",
    hostingMode: "self_host_owned",
  },
  {
    slug: "family-animation-collection",
    title: "Family animation collection",
    description: "Open-license and partner-cleared family entertainment.",
    category: "Entertainment",
    categorySlug: "entertainment",
    durationSeconds: 720,
    accessLevel: "premium",
    contentType: "video",
    hostingMode: "self_host_open",
  },
  {
    slug: "cv-basics-pakistan",
    title: "Build a clear first CV",
    titleUrdu: "اپنی پہلی سی وی بنائیں",
    description: "Simple CV guidance for students and first-time applicants.",
    category: "Rozgar",
    categorySlug: "rozgar",
    durationSeconds: 300,
    accessLevel: "public",
    contentType: "video",
    hostingMode: "self_host_owned",
  },
  {
    slug: "forts-of-pakistan",
    title: "Forts of Pakistan",
    titleUrdu: "پاکستان کے قلعے",
    description: "A visual introduction to Pakistan's historic forts.",
    category: "Pakistan",
    categorySlug: "pakistan",
    durationSeconds: 420,
    accessLevel: "public",
    contentType: "image_story",
    hostingMode: "self_host_open",
  },
];

export function formatDuration(seconds?: number | null) {
  if (!seconds) return "—";
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return remainder ? `${minutes}m ${remainder}s` : `${minutes} min`;
}
