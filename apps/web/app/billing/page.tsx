import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/database/server";
import { getPaymentServicePayments, getPaymentServiceStatus, paymentServiceEnabled, type PaymentServicePayment, type PaymentServiceStatus, type PaymentServiceSubscription } from "@/lib/payments/payment-service";
import { formatPkr } from "@/lib/payments/plans";
import { hasBackendConfiguration, isFrontendPreview } from "@/lib/runtime";
import { requestCancellation, unlinkWallet } from "./actions";

export const metadata = { title: "Billing" };
const demoSubscriptions = [{ id: "demo-sub", status: "active", current_period_end: new Date(Date.now()+86400000*30).toISOString(), plans: { name: "Jalwa Premium" } }];
const demoOrders = [{ id: "demo-order", status: "succeeded", amount_minor: 29900, currency: "PKR", created_at: new Date().toISOString(), prices: { code: "premium-monthly-pkr" } }];
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

function dateLabel(value?: string | null) {
  return value ? new Date(value).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" }) : "—";
}

function subscriptionCopy(subscription: PaymentServiceSubscription, status: PaymentServiceStatus) {
  if (subscription.status === "trialing") return `Trial access until ${dateLabel(subscription.trial_ends_at)}. First debit is automatic after the trial.`;
  if (subscription.status === "active") return `Premium access through ${dateLabel(subscription.current_period_end)}${subscription.next_due_at ? ` · Next due ${dateLabel(subscription.next_due_at)}` : ""}.`;
  if (subscription.status === "past_due") return status.status.current_period_paid && subscription.current_period_end ? `Payment needs attention. Existing paid access remains through ${dateLabel(subscription.current_period_end)} while automatic retries continue.` : "Payment is past due. Automatic retries are handled by the payment service.";
  if (subscription.status === "canceled") return subscription.current_period_end ? `Renewal stopped. Any valid paid access remains through ${dateLabel(subscription.current_period_end)}.` : "Subscription canceled. Your JazzCash wallet can remain linked for a future subscription.";
  if (subscription.status === "initiated") return "The first debit is being processed. Do not start another payment for this subscription.";
  if (subscription.status === "payment_failed") return "Automatic retries were exhausted. Premium is not active for an unpaid period.";
  if (subscription.status === "expired") return "This subscription has expired.";
  return "This subscription is paused. Jalwa Premium v1 does not offer a customer pause control.";
}

function canCancel(status: PaymentServiceSubscription["status"]) {
  return ["initiated", "trialing", "active", "past_due", "paused"].includes(status);
}

function ServiceBilling({ status, payments }: { status: PaymentServiceStatus; payments: PaymentServicePayment[] }) {
  const subscriptions = status.subscriptions.slice(0, 5);
  return <>
    <section className="panel billing-wallet-panel">
      <div><span className="eyebrow">JazzCash wallet</span><h2>{status.wallet.status === "linked" ? "Wallet linked" : `Wallet ${status.wallet.status}`}</h2><p>{status.wallet.msisdn_masked ? `Linked number ${status.wallet.msisdn_masked}.` : "Link a JazzCash wallet from Premium to start automatic billing."}</p></div>
      {status.wallet.status === "linked" ? <form action={unlinkWallet}><button className="button button-secondary" type="submit">Unlink wallet & stop future debits</button></form> : <Link className="button button-primary" href="/pricing">Link JazzCash</Link>}
    </section>
    <section className="panel"><h2>Membership</h2>{subscriptions.length ? subscriptions.map((subscription) => <div className="membership-row" key={subscription.id}>
      <div><strong>Jalwa Premium · {subscription.interval === "yearly" ? "Annual" : subscription.interval === "monthly" ? "Monthly" : "Weekly"}</strong><p>{subscriptionCopy(subscription, status)}</p>{subscription.status === "active" && subscription.charge_tier ? <small className="payment-fine-print">Latest successful charge tier: {subscription.charge_tier}. Either full or step success grants the full Premium period.</small> : null}</div>
      <div className="membership-actions"><span className="status-pill">{subscription.status}</span>{canCancel(subscription.status) ? <form action={requestCancellation}><input name="subscriptionId" type="hidden" value={subscription.id} /><button className="text-button" type="submit">Stop renewal</button></form> : null}</div>
    </div>) : <p>No subscription yet. Your linked wallet can be used to start Premium without entering MPIN again.</p>}</section>
    <section className="panel"><h2>Payment history</h2>{payments.length ? <div className="billing-list">{payments.slice(0, 50).map((payment) => <div key={payment.id}><span>{dateLabel(payment.created_at)}</span><strong>{formatPkr(payment.amount_minor)}</strong><span>{payment.charge_kind ?? "—"}</span><span>{payment.status}</span></div>)}</div> : <p>No payment history yet.</p>}</section>
  </>;
}

export default async function BillingPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const preview = isFrontendPreview() || !hasBackendConfiguration();
  const serviceEnabled = !preview && paymentServiceEnabled();

  let serviceStatus: PaymentServiceStatus | null = null;
  let servicePayments: PaymentServicePayment[] = [];
  let serviceError = false;
  let subscriptions = demoSubscriptions;
  let orders = demoOrders;

  if (!preview) {
    const database = await createClient();
    const { data: { user } } = await database.auth.getUser();
    if (!user) redirect("/login?next=/billing");
    if (serviceEnabled) {
      try { [serviceStatus, servicePayments] = await Promise.all([getPaymentServiceStatus(user.id), getPaymentServicePayments(user.id)]); }
      catch { serviceError = true; }
    } else {
      const [subscriptionResult, orderResult] = await Promise.all([
        database.from("subscriptions").select("id,status,current_period_end,plans(name)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(5),
        database.from("checkout_orders").select("id,status,amount_minor,currency,created_at,prices(code)").eq("user_id", user.id).order("created_at", { ascending: false }).limit(10),
      ]);
      subscriptions = (subscriptionResult.data ?? []) as unknown as typeof demoSubscriptions;
      orders = (orderResult.data ?? []) as unknown as typeof demoOrders;
    }
  }

  return <div className="page-shell billing-page">
    <div className="section-heading"><div><span className="eyebrow">Account</span><h1>Billing</h1></div><Link className="button button-primary" href="/pricing">View plans</Link></div>
    {serviceEnabled ? serviceError || !serviceStatus ? <section className="panel"><h2>Billing status unavailable</h2><p>Jalwa could not reach the authoritative payment service. No new payment has been started. Please try again later.</p></section> : <ServiceBilling status={serviceStatus} payments={servicePayments} /> : <>
      <section className="panel"><h2>Membership</h2>{subscriptions.length ? subscriptions.map((subscription) => <div className="membership-row" key={subscription.id}><div><strong>{subscription.status === "active" ? "Jalwa Premium" : subscription.status}</strong><p>Access until {dateLabel(subscription.current_period_end)}</p></div><div className="membership-actions"><span className="status-pill">{subscription.status}</span>{["active","past_due"].includes(subscription.status) ? <form action={requestCancellation}><input name="subscriptionId" type="hidden" value={subscription.id} /><button className="text-button" type="submit" disabled={preview}>Cancel at period end</button></form> : null}</div></div>) : <p>No active membership.</p>}</section>
      <section className="panel"><h2>Payment history</h2><div className="billing-list">{orders.map((order) => <div key={order.id}><span>{dateLabel(order.created_at)}</span><strong>{formatPkr(order.amount_minor)}</strong><span>{order.status}</span></div>)}</div></section>
    </>}
    {params.cancelled ? <p className="policy-notice">Renewal has been stopped. If the current period is already paid, Jalwa keeps Premium until its recorded period end.</p> : params.unlinked ? <p className="policy-notice">JazzCash wallet unlinked. Future debits are stopped; any already-paid access follows its recorded period end.</p> : params.error === "wallet" ? <p className="policy-notice">The wallet could not be unlinked. No local access state was changed.</p> : params.error ? <p className="policy-notice">The cancellation request could not be completed.</p> : null}
    {preview ? <p className="policy-notice">Preview data only. Connect the PostgreSQL backend and configured staging payment service to display real subscriptions and payments.</p> : null}
  </div>;
}
