import Link from "next/link";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/studio/auth";
import { roleHasCapability } from "@/lib/studio/capabilities";
import { formatPkr } from "@/lib/payments/plans";
import { resolvePaymentException } from "./actions";

export const metadata = { title: "Finance" };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function FinancePage({ searchParams }: { searchParams: SearchParams }) {
  const { database, profile } = await requireStaff();
  if (profile.role !== "finance" && profile.role !== "admin") redirect("/studio");
  const params = await searchParams;
  const canViewReports = roleHasCapability(profile.role, "premium:reports:read");

  const [ordersResult, webhooksResult, operationsResult, exceptionsResult, servicePaymentsResult] = await Promise.all([
    database.from("checkout_orders").select("id,status,amount_minor,currency,provider,created_at").order("created_at", { ascending: false }).limit(50),
    database.from("webhook_events").select("id,provider,provider_event_id,status,received_at,error_message").order("received_at", { ascending: false }).limit(30),
    database.from("payment_operations").select("id,provider,provider_event_id,operation_kind,processing_status,amount_minor,currency,created_at").order("created_at", { ascending: false }).limit(50),
    database.from("payment_exceptions").select("id,case_kind,status,amount_minor,currency,reason,created_at,resolution_note").order("created_at", { ascending: false }).limit(50),
    database.from("payment_service_payments").select("id,remote_payment_id,amount_minor,charge_kind,currency,status,txn_ref_no,response_code,remote_created_at,reconciled_at").order("remote_created_at", { ascending: false }).limit(50),
  ]);
  const queryError = ordersResult.error ?? webhooksResult.error ?? operationsResult.error ?? exceptionsResult.error ?? servicePaymentsResult.error;
  if (queryError) throw queryError;

  const notice = params.updated ? "Payment exception updated." : params.error ? "The payment exception could not be updated." : null;
  const openExceptions = (exceptionsResult.data ?? []).filter((item) => item.status === "open");

  return (
    <div>
      <div className="section-heading"><div><span className="eyebrow">Operations</span><h1>Finance</h1><p>Payment lifecycle events, payment-service reconciliation, exceptions and entitlement-impacting refunds or disputes.</p></div>{canViewReports ? <Link className="button button-primary" href="/studio/finance/reports">Open Premium reports</Link> : null}</div>
      {notice ? <p className="policy-notice" role="status">{notice}</p> : null}
      <section className="panel"><h2>Open payment exceptions</h2>{openExceptions.length ? <div className="studio-list">{openExceptions.map((item) => <article className="studio-list-item" key={item.id}><div><strong>{item.case_kind.replaceAll("_", " ")}</strong><p>{formatPkr(item.amount_minor)} · {item.reason ?? "Provider event requires finance review."}</p><small>{new Date(item.created_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</small></div><form action={resolvePaymentException} className="inline-form"><input type="hidden" name="caseId" value={item.id} /><label>Resolution note<input name="note" minLength={3} maxLength={2000} required /></label><button className="button button-primary" name="resolution" value="resolved" type="submit">Resolve</button><button className="button button-secondary" name="resolution" value="dismissed" type="submit">Dismiss</button></form></article>)}</div> : <p>No open payment exceptions.</p>}</section>
      <section className="panel"><h2>Payment-service transactions</h2>{servicePaymentsResult.data?.length ? <div className="finance-table">{servicePaymentsResult.data.map((payment) => <div key={payment.id}><span>JazzCash · {payment.charge_kind ?? "—"}</span><strong>{formatPkr(payment.amount_minor)}</strong><span>{payment.status}{payment.response_code ? ` · ${payment.response_code}` : ""}</span><time>{new Date(payment.remote_created_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</time></div>)}</div> : <p>No reconciled payment-service transactions yet.</p>}<p className="payment-fine-print">These rows are a sanitized local projection of the authoritative payment-service history for Finance. Customer billing continues to read the payment service through the authenticated BFF.</p></section>
      <section className="panel"><h2>Legacy payment operations</h2><div className="finance-table">{operationsResult.data?.map((operation) => <div key={operation.id}><span>{operation.provider}</span><strong>{operation.operation_kind}</strong><span>{formatPkr(operation.amount_minor)} · {operation.processing_status}</span><time>{new Date(operation.created_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</time></div>)}</div></section>
      <section className="panel"><h2>Legacy checkouts</h2><div className="finance-table">{ordersResult.data?.map((order) => <div key={order.id}><span>{order.provider}</span><strong>{formatPkr(order.amount_minor)}</strong><span>{order.status}</span><time>{new Date(order.created_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</time></div>)}</div></section>
      <section className="panel"><h2>Webhook events</h2><div className="finance-table">{webhooksResult.data?.map((event) => <div key={event.id}><span>{event.provider}</span><strong>{event.status}</strong><span>{event.provider_event_id}</span><time>{new Date(event.received_at).toLocaleString("en-PK", { timeZone: "Asia/Karachi" })}</time></div>)}</div></section>
    </div>
  );
}
