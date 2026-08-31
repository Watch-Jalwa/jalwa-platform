import Link from "next/link";
import { requireStaff } from "@/lib/studio/auth";

export default async function StudioPage() {
  const { database } = await requireStaff();
  const [drafts, review, published] = await Promise.all([
    database.from("content_items").select("id", { count: "exact", head: true }).eq("status", "draft"),
    database.from("content_items").select("id", { count: "exact", head: true }).in("status", ["rights_review", "editorial_review"]),
    database.from("content_items").select("id", { count: "exact", head: true }).eq("status", "published"),
  ]);
  return (
    <div>
      <div className="section-heading"><div><span className="eyebrow">Operations</span><h1>Jalwa Studio</h1></div><Link className="button button-primary" href="/studio/content/new">Add content</Link></div>
      <div className="metric-grid">
        <article><strong>{drafts.count ?? 0}</strong><span>Drafts</span></article>
        <article><strong>{review.count ?? 0}</strong><span>In review</span></article>
        <article><strong>{published.count ?? 0}</strong><span>Published</span></article>
      </div>
      <div className="notice"><strong>Publishing rule:</strong> every item needs an approved rights record before it can go live.</div>
    </div>
  );
}
