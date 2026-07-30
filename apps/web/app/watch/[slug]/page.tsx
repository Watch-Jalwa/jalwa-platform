import Link from "next/link";
import { featuredContent } from "@/lib/catalogue/demo-data";

type Params = Promise<{ slug: string }>;

export default async function WatchPage({ params }: { params: Params }) {
  const { slug } = await params;
  const item = featuredContent.find((candidate) => candidate.slug === slug);
  if (!item) return <div className="page-shell"><div className="empty-state"><h1>Content unavailable</h1><Link href="/explore">Return to Explore</Link></div></div>;
  return <div className="page-shell"><div className="empty-state"><span className="eyebrow">{item.access}</span><h1>{item.title}</h1><p>{item.category} · {item.duration}</p><p>Playback sources arrive with the media and catalogue phases.</p></div></div>;
}
