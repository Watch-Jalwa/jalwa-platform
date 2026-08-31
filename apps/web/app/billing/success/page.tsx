import Link from "next/link";
import { createClient } from "@/lib/database/server";
import { hasBackendConfiguration, isFrontendPreview } from "@/lib/runtime";

type SearchParams = Promise<{ preview?: string }>;
export const metadata = { title: "Payment complete" };

export default async function BillingSuccessPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const preview = params.preview === "1" || isFrontendPreview() || !hasBackendConfiguration();
  let active = preview;
  if (!preview) {
    const database = await createClient();
    const { data } = await database.rpc("has_active_benefit", { p_benefit: "premium_catalogue" });
    active = Boolean(data);
  }
  return <div className="page-shell narrow-page"><section className="panel billing-result"><span className="success-mark">✓</span><span className="eyebrow">{active ? "Premium active" : "Payment processing"}</span><h1>{active ? "Welcome to Jalwa Premium" : "We are confirming your payment"}</h1><p>{preview ? "The frontend journey is complete. Production access is issued only by the verified payment webhook." : active ? "Your premium benefits are now available." : "Refresh shortly if your provider callback is still processing."}</p><div className="action-row"><Link className="button button-primary" href="/">Start watching</Link><Link className="button button-secondary" href="/billing">View billing</Link></div></section></div>;
}
