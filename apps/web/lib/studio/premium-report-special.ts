/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from "@/lib/database/admin";
import { REPORT_SCHEMA_VERSION, REPORT_TIMEZONE, maskUserId } from "@/lib/reports/premium.mjs";
import { collectRows, planCode, reportContext, type ReportInput } from "@/lib/studio/premium-report-data";

function inRange(value: string | null | undefined, start: string, end: string) {
  return Boolean(value && value >= start && value < end);
}

export async function getRecurringCustomers(input: ReportInput, exportAll = false) {
  const { range, filters } = reportContext(input);
  const admin = createAdminClient();
  const [orders, subscriptions] = await Promise.all([
    collectRows((a,b) => admin.from("checkout_orders").select("id,user_id,payment_purpose,completed_at,failed_at,plan_snapshot,created_at").lt("created_at", range.endUtcExclusive).order("created_at", { ascending:false }).range(a,b)),
    collectRows((a,b) => admin.from("subscriptions").select("id,user_id,status,renewal_due_at,grace_ends_at,auto_renew_consented,plan_snapshot,created_at").lt("created_at", range.endUtcExclusive).order("created_at", { ascending:false }).range(a,b)),
  ]);
  const selectedOrders = orders.filter((row) => (!filters.plan || planCode(row) === filters.plan) && (!filters.user || row.user_id === filters.user));
  const selectedSubscriptions = subscriptions.filter((row) => (!filters.plan || planCode(row) === filters.plan) && (!filters.user || row.user_id === filters.user));
  const completedHistorical = new Set(selectedOrders.filter((row) => row.payment_purpose === "renewal" && row.completed_at && row.completed_at < range.endUtcExclusive).map((row) => row.user_id));
  const renewedInPeriod = new Set(selectedOrders.filter((row) => row.payment_purpose === "renewal" && inRange(row.completed_at, range.startUtc, range.endUtcExclusive)).map((row) => row.user_id));
  const failed = new Set(selectedOrders.filter((row) => row.payment_purpose === "renewal" && inRange(row.failed_at, range.startUtc, range.endUtcExclusive)).map((row) => row.user_id));
  const consentOnly = new Set(selectedSubscriptions.filter((row) => row.auto_renew_consented && !completedHistorical.has(row.user_id)).map((row) => row.user_id));
  const boundary = new Date(range.endUtcExclusive).getTime();
  const approaching = new Set(selectedSubscriptions.filter((row) => { const due = row.renewal_due_at ? new Date(row.renewal_due_at).getTime() : 0; return due >= boundary && due < boundary + 7*86400000; }).map((row) => row.user_id));
  const grace = new Set(selectedSubscriptions.filter((row) => row.status === "past_due" || (row.grace_ends_at && row.grace_ends_at >= range.endUtcExclusive)).map((row) => row.user_id));
  const allRows = [...completedHistorical].sort().map((userId) => ({ userId, user: maskUserId(userId), completedRenewal: true, renewedInPeriod: renewedInPeriod.has(userId), failedRenewal: failed.has(userId) }));
  if (exportAll && allRows.length > 10000) throw new Error("Recurring-customer exports are limited to 10,000 rows.");
  const rows = exportAll ? allRows : allRows.slice((filters.page-1)*filters.pageSize, filters.page*filters.pageSize);
  return { schemaVersion: REPORT_SCHEMA_VERSION, timezone: REPORT_TIMEZONE, effectiveRange: range, filters, counts: { recurringCustomers: completedHistorical.size, renewedInPeriod: renewedInPeriod.size, consentWithoutRenewal: consentOnly.size, failedRenewalCustomers: failed.size, approachingRenewal: approaching.size, graceOrPastDue: grace.size }, total: allRows.length, rows };
}

export async function getReconciliationReport(input: ReportInput, exportAll = false) {
  const { range, filters } = reportContext(input);
  const admin = createAdminClient();
  const effectiveNow = Math.min(Date.now(), new Date(range.endUtcExclusive).getTime());
  const stale = new Date(effectiveNow - 2*60*60*1000).toISOString();
  const [cases, webhooks, orders, subscriptions, refunds] = await Promise.all([
    collectRows((a,b) => admin.from("payment_exceptions").select("id,checkout_order_id,case_kind,status,amount_minor,currency,reason,created_at").eq("status","open").gte("created_at",range.startUtc).lt("created_at",range.endUtcExclusive).order("created_at",{ascending:false}).range(a,b),10000),
    collectRows((a,b) => admin.from("webhook_events").select("id,provider,provider_event_id,status,received_at,error_message").in("status",["failed","rejected"]).gte("received_at",range.startUtc).lt("received_at",range.endUtcExclusive).order("received_at",{ascending:false}).range(a,b),10000),
    collectRows((a,b) => admin.from("checkout_orders").select("id,user_id,subscription_id,status,provider_status,payment_purpose,amount_minor,currency,provider,created_at,completed_at,failed_at,reconciliation_state,attention_reason").lt("created_at",range.endUtcExclusive).order("created_at",{ascending:false}).range(a,b)),
    collectRows((a,b) => admin.from("subscriptions").select("id,user_id,status,activation_source,current_period_end,created_at").lt("created_at",range.endUtcExclusive).order("created_at",{ascending:false}).range(a,b)),
    collectRows((a,b) => admin.from("payment_refunds").select("id,checkout_order_id,subscription_id,refund_kind,amount_minor,currency,reason,refunded_at").gte("refunded_at",range.startUtc).lt("refunded_at",range.endUtcExclusive).order("refunded_at",{ascending:false}).range(a,b),10000),
  ]);
  const selectedOrders = orders.filter((row) => (!filters.purpose || row.payment_purpose === filters.purpose) && (!filters.paymentStatus || row.status === filters.paymentStatus) && (!filters.providerStatus || row.provider_status === filters.providerStatus) && (!filters.reconciliationState || row.reconciliation_state === filters.reconciliationState) && (!filters.user || row.user_id === filters.user));
  const orderById = new Map(selectedOrders.map((row) => [row.id,row]));
  const subscriptionById = new Map(subscriptions.map((row) => [row.id,row]));
  const rows:any[] = [];
  const seen = new Set<string>();
  const add = (key:string,row:any) => { if (!seen.has(key)) { seen.add(key); rows.push(row); } };

  for (const row of cases) add(`case:${row.id}`,{ id:`case:${row.id}`,kind:row.case_kind,status:row.status,orderId:row.checkout_order_id,amountMinor:row.amount_minor,currency:row.currency,reason:row.reason,createdAt:row.created_at });
  for (const row of webhooks) add(`webhook:${row.id}`,{ id:`webhook:${row.id}`,kind:"failed_or_ignored_webhook",status:row.status,provider:row.provider,providerEventId:row.provider_event_id,reason:row.error_message,createdAt:row.received_at });
  for (const row of selectedOrders) {
    if (inRange(row.created_at,range.startUtc,range.endUtcExclusive) && row.status === "pending" && row.created_at < stale) add(`stale:${row.id}`,{ id:`stale:${row.id}`,kind:"stale_pending_payment",status:row.status,orderId:row.id,user:maskUserId(row.user_id),amountMinor:row.amount_minor,currency:row.currency,provider:row.provider,reason:row.attention_reason ?? "Pending payment exceeded two hours.",createdAt:row.created_at });
    if (inRange(row.created_at,range.startUtc,range.endUtcExclusive) && row.reconciliation_state === "attention") add(`attention:${row.id}`,{ id:`attention:${row.id}`,kind:"entitlement_or_linkage_attention",status:row.status,orderId:row.id,user:maskUserId(row.user_id),amountMinor:row.amount_minor,currency:row.currency,provider:row.provider,reason:row.attention_reason,createdAt:row.created_at });
    if (inRange(row.created_at,range.startUtc,range.endUtcExclusive) && row.provider_status && row.provider_status !== row.status) add(`mismatch:${row.id}`,{ id:`mismatch:${row.id}`,kind:"provider_internal_status_mismatch",status:row.status,orderId:row.id,user:maskUserId(row.user_id),amountMinor:row.amount_minor,currency:row.currency,provider:row.provider,reason:`Provider status ${row.provider_status} differs from internal status ${row.status}.`,createdAt:row.created_at });
    if (inRange(row.completed_at,range.startUtc,range.endUtcExclusive) && ["succeeded","partially_refunded","refunded","disputed"].includes(row.status) && !row.subscription_id) add(`unlinked:${row.id}`,{ id:`unlinked:${row.id}`,kind:"completed_payment_without_subscription",status:row.status,orderId:row.id,user:maskUserId(row.user_id),amountMinor:row.amount_minor,currency:row.currency,provider:row.provider,reason:"Completed payment has no linked subscription.",createdAt:row.completed_at });
    if (inRange(row.failed_at,range.startUtc,range.endUtcExclusive) && row.payment_purpose === "renewal") add(`renewal:${row.id}`,{ id:`renewal:${row.id}`,kind:"failed_renewal",status:row.status,orderId:row.id,user:maskUserId(row.user_id),amountMinor:row.amount_minor,currency:row.currency,provider:row.provider,reason:row.attention_reason ?? "Renewal payment failed and may require operational review.",createdAt:row.failed_at });
  }
  const completedSubscriptionIds = new Set(selectedOrders.filter((row) => row.completed_at && row.subscription_id).map((row) => row.subscription_id));
  for (const subscription of subscriptions) if (subscription.activation_source === "paid" && ["active","past_due","cancel_at_period_end"].includes(subscription.status) && !completedSubscriptionIds.has(subscription.id)) add(`unpaid-sub:${subscription.id}`,{ id:`unpaid-sub:${subscription.id}`,kind:"active_paid_subscription_without_completed_payment",status:subscription.status,orderId:null,user:maskUserId(subscription.user_id),amountMinor:null,currency:null,provider:null,reason:"Paid subscription has no linked completed payment. Audited manual grants are excluded.",createdAt:subscription.created_at });
  for (const refund of refunds) {
    const subscription = refund.subscription_id ? subscriptionById.get(refund.subscription_id) : null;
    const order = orderById.get(refund.checkout_order_id);
    if (refund.refund_kind === "full" && subscription && ["active","cancel_at_period_end"].includes(subscription.status)) add(`refund:${refund.id}`,{ id:`refund:${refund.id}`,kind:"refund_not_reflected_in_subscription",status:subscription.status,orderId:refund.checkout_order_id,user:order ? maskUserId(order.user_id) : "—",amountMinor:refund.amount_minor,currency:refund.currency,provider:order?.provider,reason:refund.reason ?? "Full refund exists while paid subscription remains active.",createdAt:refund.refunded_at });
  }

  rows.sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)) || String(a.id).localeCompare(String(b.id)));
  if (exportAll && rows.length > 10000) throw new Error("Reconciliation exports are limited to 10,000 rows.");
  return { schemaVersion: REPORT_SCHEMA_VERSION, timezone: REPORT_TIMEZONE, effectiveRange: range, filters, threshold:{stalePendingHours:2}, page:exportAll?1:filters.page, pageSize:exportAll?rows.length:filters.pageSize, total:rows.length, rows:exportAll?rows:rows.slice((filters.page-1)*filters.pageSize,filters.page*filters.pageSize) };
}

export async function getBenefitCostReport(input: ReportInput) {
  const { range, filters } = reportContext(input);
  return { schemaVersion: REPORT_SCHEMA_VERSION, timezone: REPORT_TIMEZONE, effectiveRange: range, filters, supported:false, reason:"Jalwa Premium benefits have no approved monetary issue, redemption or reversal ledger.", metrics:null, rows:[] };
}
