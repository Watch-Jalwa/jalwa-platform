import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPkr } from "@/lib/payments/plans";

export const metadata = { title: "Billing" };

export default async function BillingPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/billing");

  const [{ data: subscriptions }, { data: orders }] = await Promise.all([
    supabase.from("subscriptions").select("id,status,current_period_end,plans(name)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
    supabase.from("checkout_orders").select("id,status,amount_minor,currency,created_at,prices(code)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
  ]);

  return (
    <div className="page-shell billing-page">
      <div className="section-heading"><div><span className="eyebrow">Account</span><h1>Billing</h1></div><Link className="button button-primary" href="/pricing">View plans</Link></div>
      <section className="panel"><h2>Membership</h2>{subscriptions?.length ? subscriptions.map((subscription) => <p key={subscription.id}><strong>{subscription.status}</strong> · access until {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString("en-PK") : "—"}</p>) : <p>No active membership.</p>}</section>
      <section className="panel"><h2>Payment history</h2><div className="billing-list">{orders?.map((order) => <div key={order.id}><span>{new Date(order.created_at).toLocaleDateString("en-PK")}</span><strong>{formatPkr(order.amount_minor)}</strong><span>{order.status}</span></div>)}</div></section>
    </div>
  );
}
