import Link from "next/link";
import { requireStaff } from "@/lib/studio/auth";

export const metadata = { title: "Payment operations" };
export const dynamic = "force-dynamic";

export default async function PaymentOperationsPage() {
  const { profile } = await requireStaff();
  if (profile.role !== "finance" && profile.role !== "admin") return <section className="panel" role="alert"><h1>Permission denied</h1><p>Your Studio role does not include payment operations.</p></section>;

  return <div><div className="section-heading"><div><span className="eyebrow">Finance</span><h1>Payment operations</h1><p>Use the Finance workspace for payment lifecycle events, reconciliation and exceptions. Premium reporting remains read-only and capability-gated.</p></div></div><div className="studio-grid"><article className="panel"><h2>Finance operations</h2><p>Review provider events, reconciled payments and payment exceptions.</p><Link className="button button-primary" href="/studio/finance">Open Finance</Link></article><article className="panel"><h2>Premium reports</h2><p>Inspect collections, subscriptions, renewals, reconciliation and audited exports.</p><Link className="button button-secondary" href="/studio/finance/reports">Open Premium reports</Link></article></div></div>;
}
