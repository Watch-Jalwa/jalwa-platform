import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Payment complete" };

export default async function BillingSuccessPage() {
  const supabase = await createClient();
  const { data: active } = await supabase.rpc("has_active_benefit", { p_benefit: "premium_catalogue" });
  return (
    <div className="page-shell narrow-page">
      <section className="panel billing-result">
        <span className="eyebrow">{active ? "Premium active" : "Payment processing"}</span>
        <h1>{active ? "Welcome to Jalwa Premium" : "We are confirming your payment"}</h1>
        <p>{active ? "Your premium benefits are now available." : "Refresh shortly if your provider callback is still processing."}</p>
        <div className="action-row"><Link className="button button-primary" href="/">Start watching</Link><Link className="button button-secondary" href="/billing">View billing</Link></div>
      </section>
    </div>
  );
}
