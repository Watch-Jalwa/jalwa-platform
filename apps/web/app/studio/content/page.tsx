import Link from "next/link";
import { requireStaff } from "@/lib/studio/auth";

export const metadata = { title: "Content" };

export default async function StudioContentPage() {
  const { supabase } = await requireStaff();
  const { data: items } = await supabase
    .from("content_items")
    .select("id,slug,title_en,status,content_type,access_level,updated_at")
    .order("updated_at", { ascending: false })
    .limit(100);
  return (
    <div>
      <div className="section-heading"><div><span className="eyebrow">Catalogue</span><h1>Content</h1></div><Link className="button button-primary" href="/studio/content/new">Add content</Link></div>
      <div className="table-shell">
        <table><thead><tr><th>Title</th><th>Status</th><th>Type</th><th>Access</th></tr></thead>
          <tbody>{(items ?? []).map((item) => <tr key={item.id}><td><Link href={`/studio/content/${item.id}`}>{item.title_en}</Link><small>{item.slug}</small></td><td><span className="status-badge">{item.status}</span></td><td>{item.content_type}</td><td>{item.access_level}</td></tr>)}</tbody>
        </table>
        {!items?.length ? <div className="empty-state">No content drafts yet.</div> : null}
      </div>
    </div>
  );
}
