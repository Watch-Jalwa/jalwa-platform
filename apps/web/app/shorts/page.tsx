import type { Metadata } from "next";
import { ShortsFeed } from "@/components/shorts-feed";
import { searchCatalogue } from "@/lib/catalogue/repository";

export const metadata: Metadata = { title: "Shorts" };
export const dynamic = "force-dynamic";

export default async function ShortsPage() {
  const items = (await searchCatalogue({ category: "shorts", limit: 30 })).filter((item) => item.contentType === "short");
  return <div className="page-shell"><div className="section-heading"><div><span className="eyebrow">Swipe and discover</span><h1>Jalwa Shorts</h1></div></div>{items.length ? <ShortsFeed items={items} /> : <div className="panel"><p>Shorts will appear after the first media jobs finish processing.</p></div>}</div>;
}
