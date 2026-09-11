import Link from "next/link";
import { requireStaff } from "@/lib/studio/auth";

export const metadata = { title: "Rights operations" };
export const dynamic = "force-dynamic";

type RightsRow = { content_id: string; status: string; creator: string | null; expires_at: string | null; is_expired: boolean; expires_within_30_days: boolean };

export default async function RightsOperationsPage() {
  const { database, profile } = await requireStaff();
  if (profile.role !== "rights_reviewer" && profile.role !== "admin") return <section className="panel" role="alert"><h1>Permission denied</h1><p>Your Studio role does not include rights operations.</p></section>;
  const { data, error } = await database.from("rights_operations").select("content_id,status,creator,expires_at,is_expired,expires_within_30_days").order("expires_at", { ascending: true }).limit(250);
  if (error) throw error;
  const rows = (data ?? []) as RightsRow[];
  return <div><div className="section-heading"><div><span className="eyebrow">Governance</span><h1>Rights operations</h1><p>Operational queue for pending, expired and upcoming rights reviews.</p></div><Link className="button button-secondary" href="/studio/rights">Rights overview</Link></div><div className="table-shell"><table><thead><tr><th>Status</th><th>Creator</th><th>Expiry</th><th>Action</th></tr></thead><tbody>{rows.map((row) => <tr key={row.content_id}><td><span className="status-badge">{row.status}</span>{row.is_expired ? <small>Expired</small> : row.expires_within_30_days ? <small>Review within 30 days</small> : null}</td><td>{row.creator ?? "Not recorded"}</td><td>{row.expires_at ? new Date(row.expires_at).toLocaleDateString("en-PK") : "No expiry"}</td><td><Link href={`/studio/content/${row.content_id}`}>Review content</Link></td></tr>)}</tbody></table>{!rows.length ? <div className="empty-state">No rights records are available.</div> : null}</div></div>;
}
