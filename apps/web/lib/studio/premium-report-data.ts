/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from "@/lib/database/admin";
import { REPORT_SCHEMA_VERSION, REPORT_TIMEZONE, calculatePremiumSummary, maskUserId, normalizeFilters, resolveReportRange, type ReportFilters, type ReportRange } from "@/lib/reports/premium.mjs";

export type ReportInput = Record<string, string | string[] | undefined> | URLSearchParams;
export type ReportContext = { range: ReportRange; filters: ReportFilters; input: Record<string, string> };

function inputRecord(input: ReportInput) {
  if (input instanceof URLSearchParams) return Object.fromEntries(input.entries());
  return Object.fromEntries(Object.entries(input).flatMap(([key, value]) => typeof value === "string" ? [[key, value]] : Array.isArray(value) && value[0] ? [[key, value[0]]] : []));
}

export function reportContext(input: ReportInput): ReportContext {
  const normalized = inputRecord(input);
  return { input: normalized, range: resolveReportRange(normalized), filters: normalizeFilters(normalized) };
}

export function planCode(row: any) { return row.plan_snapshot?.code ?? row.price_snapshot?.planCode ?? null; }
export function expandedStart(range: ReportRange) { return new Date(new Date(range.startUtc).getTime() - 86400000).toISOString(); }

export async function collectRows(makeQuery: (from: number, to: number) => PromiseLike<any>, maxRows = 50000) {
  const rows: any[] = [];
  for (let from = 0; from < maxRows; from += 1000) {
    const { data, error } = await makeQuery(from, from + 999);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < 1000) return rows;
  }
  throw new Error(`Report source exceeded the ${maxRows.toLocaleString("en-PK")} row safety limit.`);
}

function filterRows(rows: any[], filters: ReportFilters) {
  return rows.filter((row) => (!filters.plan || planCode(row) === filters.plan)
    && (!filters.purpose || row.payment_purpose === filters.purpose)
    && (!filters.paymentStatus || row.status === filters.paymentStatus)
    && (!filters.providerStatus || row.provider_status === filters.providerStatus)
    && (!filters.reconciliationState || row.reconciliation_state === filters.reconciliationState)
    && (!filters.user || row.user_id === filters.user));
}

export async function getPremiumSummary(input: ReportInput) {
  const { range, filters } = reportContext(input);
  const admin = createAdminClient();
  const [orders, refunds, subscriptions, statusEvents, exceptionCount] = await Promise.all([
    collectRows((a,b) => admin.from("checkout_orders").select("id,user_id,subscription_id,status,amount_minor,currency,payment_purpose,plan_snapshot,price_snapshot,provider_status,created_at,completed_at,failed_at,reconciliation_state").lt("created_at", range.endUtcExclusive).order("created_at").range(a,b)),
    collectRows((a,b) => admin.from("payment_refunds").select("checkout_order_id,amount_minor,refunded_at").gte("refunded_at", range.startUtc).lt("refunded_at", range.endUtcExclusive).order("refunded_at").range(a,b)),
    collectRows((a,b) => admin.from("subscriptions").select("id,user_id,status,activation_source,current_period_start,current_period_end,grace_ends_at,auto_renew_consented,auto_renew_consented_at,cancel_at_period_end,plan_snapshot,price_snapshot,created_at").lt("created_at", range.endUtcExclusive).order("created_at").range(a,b)),
    collectRows((a,b) => admin.from("subscription_status_events").select("subscription_id,status,current_period_start,current_period_end,cancel_at_period_end,grace_ends_at,occurred_at").lt("occurred_at", range.endUtcExclusive).order("occurred_at", { ascending: false }).range(a,b)),
    admin.from("payment_exceptions").select("id", { count: "exact", head: true }).eq("status", "open"),
  ]);
  const selectedOrders = filterRows(orders, filters);
  const attempts = selectedOrders.filter((row) => row.created_at >= range.startUtc && row.created_at < range.endUtcExclusive).map((row) => ({
    checkout_order_id: row.id,
    created_at: row.created_at,
    status: ["succeeded","refunded","partially_refunded","disputed"].includes(row.status) ? "succeeded" : row.status === "failed" ? "failed" : ["created","pending"].includes(row.status) ? "pending" : "cancelled",
  }));
  const latestEvent = new Map<string, any>();
  for (const event of statusEvents) if (!latestEvent.has(event.subscription_id)) latestEvent.set(event.subscription_id, event);
  const historicalSubscriptions = subscriptions.map((subscription) => {
    const event = latestEvent.get(subscription.id);
    return { ...(event ? { ...subscription, status: event.status, current_period_start: event.current_period_start, current_period_end: event.current_period_end, cancel_at_period_end: event.cancel_at_period_end, grace_ends_at: event.grace_ends_at } : subscription), auto_renew_consented: Boolean(subscription.auto_renew_consented_at && subscription.auto_renew_consented_at < range.endUtcExclusive) };
  });
  const selectedSubscriptions = historicalSubscriptions.filter((row) => (!filters.plan || planCode(row) === filters.plan) && (!filters.subscriptionStatus || row.status === filters.subscriptionStatus) && (!filters.user || row.user_id === filters.user));
  const selectedOrderIds = new Set(selectedOrders.map((order) => order.id));
  const result = calculatePremiumSummary({ orders: selectedOrders, attempts, refunds: refunds.filter((row) => selectedOrderIds.has(row.checkout_order_id)), subscriptions: selectedSubscriptions, range, groupBy: filters.groupBy });
  result.kpis.reconciliationAttention = exceptionCount.count ?? 0;
  result.kpis.disputes = selectedOrders.filter((row) => row.status === "disputed").length;
  return { ...result, filters, generatedAt: new Date().toISOString(), support: { benefitCosts: { supported: false, reason: "No approved monetary benefit ledger exists." }, autoRenew: { supported: selectedSubscriptions.some((row) => row.auto_renew_consented_at) } } };
}

export async function getPaymentLedger(input: ReportInput, exportAll = false) {
  const { range, filters } = reportContext(input);
  const admin = createAdminClient();
  let query = admin.from("checkout_orders").select("id,user_id,subscription_id,status,amount_minor,currency,provider,provider_order_reference,payment_purpose,plan_snapshot,price_snapshot,provider_status,created_at,initiated_at,completed_at,failed_at,reconciliation_state,attention_reason", { count: "exact" }).gte("created_at", range.startUtc).lt("created_at", range.endUtcExclusive).order("created_at", { ascending: false }).order("id", { ascending: false });
  if (filters.purpose) query = query.eq("payment_purpose", filters.purpose);
  if (filters.paymentStatus) query = query.eq("status", filters.paymentStatus);
  if (filters.providerStatus) query = query.eq("provider_status", filters.providerStatus);
  if (filters.reconciliationState) query = query.eq("reconciliation_state", filters.reconciliationState);
  if (filters.user) query = query.eq("user_id", filters.user);
  if (filters.reference) query = query.ilike("provider_order_reference", `%${filters.reference}%`);
  if (filters.plan) query = query.contains("plan_snapshot", { code: filters.plan });
  const from = exportAll ? 0 : (filters.page - 1) * filters.pageSize;
  const { data, error, count } = await query.range(from, exportAll ? 9999 : from + filters.pageSize - 1);
  if (error) throw error;
  if (exportAll && (count ?? 0) > 10000) throw new Error("Payment exports are limited to 10,000 rows. Narrow the selected range.");
  const orderIds = (data ?? []).map((row) => row.id);
  const { data: attempts, error: attemptError } = orderIds.length ? await admin.from("payment_attempts").select("checkout_order_id,provider_transaction_id,created_at").in("checkout_order_id", orderIds).order("created_at", { ascending: false }) : { data: [], error: null };
  if (attemptError) throw attemptError;
  const transactionByOrder = new Map<string,string>();
  for (const attempt of attempts ?? []) if (attempt.provider_transaction_id && !transactionByOrder.has(attempt.checkout_order_id)) transactionByOrder.set(attempt.checkout_order_id, attempt.provider_transaction_id);
  const rows = (data ?? []).map((row) => ({ id: row.id, user: maskUserId(row.user_id), userId: row.user_id, subscriptionId: row.subscription_id, plan: row.plan_snapshot?.name ?? "Legacy plan", planCode: planCode(row) ?? "legacy-unknown", priceCode: row.price_snapshot?.code ?? "legacy-unknown", purpose: row.payment_purpose, amountMinor: row.amount_minor, currency: row.currency, provider: row.provider, internalStatus: row.status, providerStatus: row.provider_status ?? "unknown", providerOrderReference: row.provider_order_reference, providerTransactionReference: transactionByOrder.get(row.id) ?? null, createdAt: row.created_at, initiatedAt: row.initiated_at, completedAt: row.completed_at, failedAt: row.failed_at, reconciliationState: row.reconciliation_state, attentionReason: row.attention_reason }));
  return { schemaVersion: REPORT_SCHEMA_VERSION, timezone: REPORT_TIMEZONE, effectiveRange: range, filters, page: exportAll ? 1 : filters.page, pageSize: exportAll ? rows.length : filters.pageSize, total: count ?? rows.length, rows };
}

export async function getSubscriptionLedger(input: ReportInput, exportAll = false) {
  const { range, filters } = reportContext(input);
  const admin = createAdminClient();
  let query = admin.from("subscriptions").select("id,user_id,status,activation_source,provider,activated_at,current_period_start,current_period_end,renewal_due_at,cancel_at_period_end,cancellation_requested_at,cancelled_at,grace_ends_at,expired_at,auto_renew_consented,auto_renew_consented_at,plan_snapshot,price_snapshot,created_at", { count: "exact" }).lt("created_at", range.endUtcExclusive).order("created_at", { ascending: false }).order("id", { ascending: false });
  if (filters.subscriptionStatus) query = query.eq("status", filters.subscriptionStatus);
  if (filters.user) query = query.eq("user_id", filters.user);
  if (filters.plan) query = query.contains("plan_snapshot", { code: filters.plan });
  const from = exportAll ? 0 : (filters.page - 1) * filters.pageSize;
  const { data, error, count } = await query.range(from, exportAll ? 9999 : from + filters.pageSize - 1);
  if (error) throw error;
  if (exportAll && (count ?? 0) > 10000) throw new Error("Subscription exports are limited to 10,000 rows. Narrow the selected range.");
  const subscriptions = data ?? [];
  const ids = subscriptions.map((row) => row.id);
  const { data: orders, error: orderError } = ids.length ? await admin.from("checkout_orders").select("id,subscription_id,payment_purpose,amount_minor,currency,completed_at,failed_at").in("subscription_id", ids).order("created_at", { ascending: false }) : { data: [], error: null };
  if (orderError) throw orderError;
  const orderIds = (orders ?? []).map((row) => row.id);
  const { data: refunds, error: refundError } = orderIds.length ? await admin.from("payment_refunds").select("checkout_order_id,amount_minor").in("checkout_order_id", orderIds) : { data: [], error: null };
  if (refundError) throw refundError;
  const refundMap = new Map<string,number>();
  for (const row of refunds ?? []) refundMap.set(row.checkout_order_id, (refundMap.get(row.checkout_order_id) ?? 0) + Number(row.amount_minor));
  const rows = subscriptions.map((subscription) => {
    const related = (orders ?? []).filter((row) => row.subscription_id === subscription.id);
    const successful = related.filter((row) => row.completed_at);
    const failed = related.filter((row) => row.failed_at);
    const gross = successful.reduce((sum,row) => sum + Number(row.amount_minor), 0);
    const refunded = successful.reduce((sum,row) => sum + (refundMap.get(row.id) ?? 0), 0);
    return { id: subscription.id, user: maskUserId(subscription.user_id), userId: subscription.user_id, plan: subscription.plan_snapshot?.name ?? "Legacy plan", planCode: planCode(subscription) ?? "legacy-unknown", priceCode: subscription.price_snapshot?.code ?? "legacy-unknown", provider: subscription.provider, status: subscription.status, activationSource: subscription.activation_source, activatedAt: subscription.activated_at, currentPeriodStart: subscription.current_period_start, currentPeriodEnd: subscription.current_period_end, renewalDueAt: subscription.renewal_due_at, cancelAtPeriodEnd: subscription.cancel_at_period_end, cancellationRequestedAt: subscription.cancellation_requested_at, cancelledAt: subscription.cancelled_at, graceEndsAt: subscription.grace_ends_at, expiredAt: subscription.expired_at, autoRenewConsented: subscription.auto_renew_consented, autoRenewConsentedAt: subscription.auto_renew_consented_at, successfulActivationCount: successful.filter((row) => row.payment_purpose === "activation").length, successfulRenewalCount: successful.filter((row) => row.payment_purpose === "renewal").length, failedRenewalCount: failed.filter((row) => row.payment_purpose === "renewal").length, lastSuccessfulPaymentAt: successful[0]?.completed_at ?? null, lastFailedPaymentAt: failed[0]?.failed_at ?? null, lifetimeCollectedRevenueMinor: gross - refunded, currency: successful[0]?.currency ?? subscription.price_snapshot?.currency ?? "PKR" };
  });
  return { schemaVersion: REPORT_SCHEMA_VERSION, timezone: REPORT_TIMEZONE, effectiveRange: range, filters, page: exportAll ? 1 : filters.page, pageSize: exportAll ? rows.length : filters.pageSize, total: count ?? rows.length, rows };
}
