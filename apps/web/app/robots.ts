import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://watch-jalwa.com";
  return {
    rules: [
      { userAgent: "*", allow: "/", disallow: ["/studio/", "/api/", "/profile", "/billing"] },
    ],
    sitemap: `${base.replace(/\/$/, "")}/sitemap.xml`,
    host: base,
  };
}
