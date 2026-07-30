import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { formatPkr } from "@/lib/payments/plans";
import { hasSupabaseConfig, isFrontendPreview } from "@/lib/runtime";
import { requestCancellation } from "./actions";

export const metadata = { title: "Billing" };
const demoSubscriptions = [{ id: "demo-sub", status: "active", current_period_end: new Date(Date.now()+86400000*30).toISOString(), plans: { name: "Jalwa Premium" } }];
const demoOrders = [{ id: "demo-order", status: "succeeded", amount_minor: 29900, currency: "PKR", created_at: new Date().toISOString(), prices: { code: "premium-monthly-pkr" } }];

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function BillingPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const preview = isFrontendPreview() || !hasSupabaseConfig();
  let subscriptions = demoSubscriptions;
  let orders = demoOrders;
  if (!preview) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) redirect("/login?next=/billing");
    const [subscriptionResult, orderResult] = await Promise.all([
      supabase.from("subscriptions").select("id,status,current_period_end,plans(name)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
      supabase.from("checkout_orders").select("id,status,amount_minor,currency,created_at,prices(code)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
    ]);
    subscriptions = (subscriptionResult.data ?? []) as unknown as typeof demoSubscriptions;
    orders = (orderResult.data ?? []) as unknown as typeof demoOrders;
  }
  return <div className="page-shell billing-page"><div className="section-heading"><div><span className="eyebrow">Account</span><h1>Billing</h1></div><Link className="button button-primary" href="/pricing">View plans</Link></div><section className="panel"><h2>Membership</h2>{subscriptions.length ? subscriptions.map((subscription) => <div className="membership-row" key={subscription.id}><div><strong>{subscription.status === "active" ? "Jalwa Premium" : subscription.status}</strong><p>Access until {subscription.current_period_end ? new Date(subscription.current_period_end).toLocaleDateString("en-PK") : "—"}</p></div><div className="membership-actions"><span className="status-pill">{subscription.status}</span>{["active","past_due"].includes(subscription.status) ? <form action={requestCancellation}><input name="subscriptionId" type="hidden" value={subscription.id} /><button className="text-button" type="submit" disabled={preview}>Cancel at period end</button></form> : null}</div></div>) : <p>No active membership.</p>}</section><section className="panel"><h2>Payment history</h2><div className="billing-list">{orders.map((order) => <div key={order.id}><span>{new Date(order.created_at).toLocaleDateString("en-PK")}</span><strong>{formatPkr(order.amount_minor)}</strong><span>{order.status}</span></div>)}</div></section>{params.cancelled ? <p className="policy-notice">Cancellation is scheduled for the end of the current paid period.</p> : params.error ? <p className="policy-notice">The cancellation request could not be completed.</p> : null}{preview ? <p className="policy-notice">Preview data only. Connect Supabase and a merchant adapter to display real subscriptions and orders.</p> : null}</div>;
}
