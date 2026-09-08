import Link from "next/link";
import { requireStaff } from "@/lib/studio/auth";

export const metadata = { title: "Rights" };
export const dynamic = "force-dynamic";

type RightsRow = {
  content_id: string;
  status: string;
  creator: string | null;
  expires_at: string | null;
  is_expired: boolean;
  expires_within_30_days: boolean;
};

function denied() {
  return <section className="panel" role="alert"><h1>Permission denied</h1><p>Your Studio role does not include rights review access.</p></section>;
}

export default async function RightsPage() {
  const { database, profile } = await requireStaff();
  if (profile.role !== "rights_reviewer" && profile.role !== "admin") return denied();
  const { data, error } = await database
    .from("rights_operations")
    .select("content_id,status,creator,expires_at,is_expired,expires_within_30_days")
    .order("expires_at", { ascending: true, nullsFirst: false })
    .limit(200);
  if (error) throw error;
  const rows = (data ?? []) as RightsRow[];
  const attention = rows.filter((row) => row.status !== "approved" || row.is_expired || row.expires_within_30_days);

  return <div>
    <div className="section-heading"><div><span className="eyebrow">Governance</span><h1>Rights</h1><p>Review source ownership, licence evidence and expiry before content is published.</p></div><Link className="button button-primary" href="/studio/rights/operations">Rights operations</Link></div>
    <div className="operations-grid">
      <article className="operation-card"><strong>{rows.length}</strong><span>Rights records</span></article>
      <article className="operation-card"><strong>{attention.length}</strong><span>Need attention</span></article>
      <article className="operation-card"><strong>{rows.filter((row) => row.status === "approved" && !row.is_expired).length}</strong><span>Approved</span></article>
    </div>
    <section className="panel"><h2>Review queue</h2>{attention.length ? <div className="studio-list">{attention.slice(0, 50).map((row) => <article className="studio-list-item" key={row.content_id}><div><strong>{row.creator ?? "Source owner not recorded"}</strong><p>{row.status}{row.is_expired ? " · expired" : row.expires_within_30_days ? " · expires within 30 days" : ""}</p></div><Link href={`/studio/content/${row.content_id}`}>Open content</Link></article>)}</div> : <p>No rights records currently require attention.</p>}</section>
  </div>;
}
