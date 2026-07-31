import Link from "next/link";
import { requireStaff } from "@/lib/studio/auth";

export const metadata = { title: "Content" };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

type RightsSummary = {
  content_id: string;
  status: string;
  expires_at: string | null;
  creator: string | null;
  is_expired: boolean;
  expires_within_30_days: boolean;
};

export default async function StudioContentPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const q = typeof params.q === "string" ? params.q.trim().toLowerCase() : "";
  const status = typeof params.status === "string" ? params.status : "";
  const rightsStatus = typeof params.rights === "string" ? params.rights : "";
  const view = typeof params.view === "string" ? params.view : "";
  const { supabase } = await requireStaff();

  const { data: items } = await supabase
    .from("content_items")
    .select("id,slug,title_en,status,content_type,access_level,hosting_mode,updated_at")
    .order("updated_at", { ascending: false })
    .limit(250);

  const contentIds = (items ?? []).map((item) => item.id);
  const { data: rightsRows } = contentIds.length
    ? await supabase.from("rights_operations").select("content_id,status,expires_at,creator,is_expired,expires_within_30_days").in("content_id", contentIds)
    : { data: [] as RightsSummary[] };

  const rightsByContent = new Map<string, RightsSummary>();
  for (const row of (rightsRows ?? []) as RightsSummary[]) {
    const current = rightsByContent.get(row.content_id);
    if (!current || row.status === "approved") rightsByContent.set(row.content_id, row);
  }

  const filtered = (items ?? []).filter((item) => {
    const rights = rightsByContent.get(item.id);
    if (q && !`${item.title_en} ${item.slug}`.toLowerCase().includes(q)) return false;
    if (status && item.status !== status) return false;
    if (rightsStatus && rights?.status !== rightsStatus) return false;
    if (view === "expiring" && !rights?.expires_within_30_days) return false;
    return true;
  });

  return (
    <div>
      <div className="section-heading">
        <div><span className="eyebrow">Catalogue operations</span><h1>Content</h1></div>
        <Link className="button button-primary" href="/studio/content/new">Add content</Link>
      </div>

      <form className="panel" method="get">
        <div className="studio-grid">
          <label className="form-field"><span>Search title or slug</span><input name="q" defaultValue={q} /></label>
          <label className="form-field"><span>Content status</span><select name="status" defaultValue={status}><option value="">All</option><option value="draft">Draft</option><option value="rights_review">Rights review</option><option value="editorial_review">Editorial review</option><option value="published">Published</option><option value="unavailable">Unavailable</option><option value="removed">Removed</option></select></label>
          <label className="form-field"><span>Rights status</span><select name="rights" defaultValue={rightsStatus}><option value="">All</option><option value="pending">Pending</option><option value="approved">Approved</option><option value="rejected">Rejected</option><option value="expired">Expired</option></select></label>
          <label className="form-field"><span>Operational view</span><select name="view" defaultValue={view}><option value="">All records</option><option value="expiring">Expired or expiring within 30 days</option></select></label>
        </div>
        <div className="action-row"><button className="button button-secondary" type="submit">Apply filters</button><Link className="button" href="/studio/content">Clear</Link></div>
      </form>

      <div className="table-shell">
        <table>
          <thead><tr><th>Title</th><th>Content</th><th>Rights</th><th>Expiry</th><th>Access</th></tr></thead>
          <tbody>{filtered.map((item) => {
            const rights = rightsByContent.get(item.id);
            return (
              <tr key={item.id}>
                <td><Link href={`/studio/content/${item.id}`}>{item.title_en}</Link><small>{item.slug}</small></td>
                <td><span className="status-badge">{item.status}</span><small>{item.content_type} · {item.hosting_mode}</small></td>
                <td><span className="status-badge">{rights?.status ?? "missing"}</span><small>{rights?.creator ?? "No source owner"}</small></td>
                <td>{rights?.expires_at ? <><span>{new Date(rights.expires_at).toLocaleDateString("en-PK")}</span>{rights.is_expired ? <small>Expired — public access is blocked</small> : null}</> : "No expiry"}</td>
                <td>{item.access_level}</td>
              </tr>
            );
          })}</tbody>
        </table>
        {!filtered.length ? <div className="empty-state">No catalogue records match these operational filters.</div> : null}
      </div>
    </div>
  );
}
