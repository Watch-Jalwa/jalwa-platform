import type { MetadataRoute } from "next";
import { policySlugs } from "@/lib/legal/policies";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "https://watch-jalwa.com").replace(/\/$/, "");
  const now = new Date();
  const routes = ["", "/explore", "/shorts", "/pricing", "/support", "/ask"];
  const categories = ["deen", "kissan", "learn", "tech", "rozgar", "pakistan", "kids", "life", "entertainment"];
  return [
    ...routes.map((path) => ({ url: `${base}${path}`, lastModified: now, changeFrequency: path === "" ? "daily" as const : "weekly" as const, priority: path === "" ? 1 : .7 })),
    ...categories.map((category) => ({ url: `${base}/explore?category=${category}`, lastModified: now, changeFrequency: "weekly" as const, priority: .65 })),
    ...policySlugs.map((slug) => ({ url: `${base}/legal/${slug}`, lastModified: now, changeFrequency: "monthly" as const, priority: .3 })),
  ];
}
