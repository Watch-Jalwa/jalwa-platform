import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/studio/auth";
import { formatPkr } from "@/lib/payments/plans";

export const metadata = { title: "Finance" };

export default async function FinancePage() {
  const { supabase, profile } = await requireStaff();
  if (profile.role !== "finance" && profile.role !== "admin") redirect("/studio");

  const [{ data: orders }, { data: webhooks }] = await Promise.all([
    supabase.from("checkout_orders").select("id,status,amount_minor,currency,provider,created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("webhook_events").select("id,provider,provider_event_id,status,received_at,error_message").order("received_at", { ascending: false }).limit(30),
  ]);

  return (
    <div>
      <div className="section-heading"><div><span className="eyebrow">Operations</span><h1>Finance</h1></div></div>
      <section className="panel"><h2>Recent checkouts</h2><div className="finance-table">{orders?.map((order) => <div key={order.id}><span>{order.provider}</span><strong>{formatPkr(order.amount_minor)}</strong><span>{order.status}</span><time>{new Date(order.created_at).toLocaleString("en-PK")}</time></div>)}</div></section>
      <section className="panel"><h2>Webhook events</h2><div className="finance-table">{webhooks?.map((event) => <div key={event.id}><span>{event.provider}</span><strong>{event.status}</strong><span>{event.provider_event_id}</span><time>{new Date(event.received_at).toLocaleString("en-PK")}</time></div>)}</div></section>
    </div>
  );
}
