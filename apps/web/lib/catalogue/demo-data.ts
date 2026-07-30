export type DemoContentItem = { slug: string; title: string; category: string; duration: string; access: "Free" | "Premium" };

export const categories = [
  { slug: "deen", label: "Deen", urdu: "دین", icon: "☾" },
  { slug: "kissan", label: "Kissan", urdu: "کسان", icon: "🌾" },
  { slug: "learn", label: "Learn", urdu: "سیکھیں", icon: "◫" },
  { slug: "tech", label: "Tech & AI", urdu: "ٹیکنالوجی", icon: "⌁" },
  { slug: "rozgar", label: "Rozgar", urdu: "روزگار", icon: "↗" },
  { slug: "pakistan", label: "Pakistan", urdu: "پاکستان", icon: "◆" },
  { slug: "kids", label: "Kids", urdu: "بچے", icon: "✿" },
  { slug: "entertainment", label: "Entertainment", urdu: "تفریح", icon: "▶" },
] as const;

export const featuredContent: DemoContentItem[] = [
  { slug: "water-smart-farming", title: "Water-smart farming basics", category: "Kissan", duration: "4 min", access: "Free" },
  { slug: "ai-in-urdu", title: "AI explained in simple Urdu", category: "Tech & AI", duration: "6 min", access: "Free" },
  { slug: "one-minute-seerah", title: "One Minute Seerah", category: "Deen", duration: "1 min", access: "Free" },
  { slug: "open-animation", title: "Family animation collection", category: "Entertainment", duration: "12 min", access: "Premium" },
];
