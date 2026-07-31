import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/studio/auth";
import { formatPkr } from "@/lib/payments/plans";
import { resolvePaymentException } from "./actions";

export const metadata = { title: "Finance" };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function FinancePage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, profile } = await requireStaff();
  if (profile.role !== "finance" && profile.role !== "admin") redirect("/studio");
  const params = await searchParams;

  const [ordersResult, webhooksResult, operationsResult, exceptionsResult] = await Promise.all([
    supabase.from("checkout_orders").select("id,status,amount_minor,currency,provider,created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("webhook_events").select("id,provider,provider_event_id,status,received_at,error_message").order("received_at", { ascending: false }).limit(30),
    supabase.from("payment_operations").select("id,provider,provider_event_id,operation_kind,processing_status,amount_minor,currency,created_at").order("created_at", { ascending: false }).limit(50),
    supabase.from("payment_exceptions").select("id,case_kind,status,amount_minor,currency,reason,created_at,resolution_note").order("created_at", { ascending: false }).limit(50),
  ]);
  const queryError = ordersResult.error ?? webhooksResult.error ?? operationsResult.error ?? exceptionsResult.error;
  if (queryError) throw queryError;

  const notice = params.updated ? "Payment exception updated." : params.error ? "The payment exception could not be updated." : null;
  const openExceptions = (exceptionsResult.data ?? []).filter((item) => item.status === "open");

  return (
    <div>
      <div className="section-heading"><div><span className="eyebrow">Operations</span><h1>Finance</h1><p>Payment lifecycle events, reconciliation exceptions and entitlement-impacting refunds or disputes.</p></div></div>
      {notice ? <p className="policy-notice" role="status">{notice}</p> : null}
      <section className="panel"><h2>Open payment exceptions</h2>{openExceptions.length ? <div className="studio-list">{openExceptions.map((item) => <article className="studio-list-item" key={item.id}><div><strong>{item.case_kind.replaceAll("_", " ")}</strong><p>{formatPkr(item.amount_minor)} · {item.reason ?? "Provider event requires finance review."}</p><small>{new Date(item.created_at).toLocaleString("en-PK")}</small></div><form action={resolvePaymentException} className="inline-form"><input type="hidden" name="caseId" value={item.id} /><label>Resolution note<input name="note" minLength={3} maxLength={2000} required /></label><button className="button button-primary" name="resolution" value="resolved" type="submit">Resolve</button><button className="button button-secondary" name="resolution" value="dismissed" type="submit">Dismiss</button></form></article>)}</div> : <p>No open payment exceptions.</p>}</section>
      <section className="panel"><h2>Payment operations</h2><div className="finance-table">{operationsResult.data?.map((operation) => <div key={operation.id}><span>{operation.provider}</span><strong>{operation.operation_kind}</strong><span>{formatPkr(operation.amount_minor)} · {operation.processing_status}</span><time>{new Date(operation.created_at).toLocaleString("en-PK")}</time></div>)}</div></section>
      <section className="panel"><h2>Recent checkouts</h2><div className="finance-table">{ordersResult.data?.map((order) => <div key={order.id}><span>{order.provider}</span><strong>{formatPkr(order.amount_minor)}</strong><span>{order.status}</span><time>{new Date(order.created_at).toLocaleString("en-PK")}</time></div>)}</div></section>
      <section className="panel"><h2>Webhook events</h2><div className="finance-table">{webhooksResult.data?.map((event) => <div key={event.id}><span>{event.provider}</span><strong>{event.status}</strong><span>{event.provider_event_id}</span><time>{new Date(event.received_at).toLocaleString("en-PK")}</time></div>)}</div></section>
    </div>
  );
}
