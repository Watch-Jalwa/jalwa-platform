import Link from "next/link";
import { requireStaff } from "@/lib/studio/auth";

export const metadata = { title: "Privacy" };
export const dynamic = "force-dynamic";

export default async function PrivacyPage() {
  const { profile } = await requireStaff();
  if (profile.role !== "support" && profile.role !== "admin") return <section className="panel" role="alert"><h1>Permission denied</h1><p>Your Studio role does not include privacy operations.</p></section>;

  return <div><div className="section-heading"><div><span className="eyebrow">Trust</span><h1>Privacy</h1><p>Operational entry point for account and privacy requests. Sensitive request handling remains within audited Studio workflows.</p></div></div><section className="panel"><h2>Privacy operations</h2><p>Open the operations workspace to review pending account-request volume and platform readiness without exposing request contents on this overview.</p><Link className="button button-secondary" href="/studio/operations">Open Operations</Link></section></div>;
}
