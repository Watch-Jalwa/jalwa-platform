/* eslint-disable @typescript-eslint/no-explicit-any */
import { createAdminClient } from "@/lib/supabase/admin";
import { REPORT_SCHEMA_VERSION, REPORT_TIMEZONE, maskUserId } from "@/lib/reports/premium.mjs";
import { collectRows, expandedStart, planCode, reportContext, type ReportInput } from "@/lib/studio/premium-report-data";

export async function getRecurringCustomers(input: ReportInput, exportAll = false) {
  const { range, filters } = reportContext(input);
  const admin = createAdminClient();
  const [orders, subscriptions] = await Promise.all([
    collectRows((a,b) => admin.from("checkout_orders").select("id,user_id,payment_purpose,completed_at,failed_at,plan_snapshot,created_at").gte("created_at", expandedStart(range)).lt("created_at", range.endUtcExclusive).order("created_at", { ascending:false }).range(a,b)),
    collectRows((a,b) => admin.from("subscriptions").select("id,user_id,status,renewal_due_at,grace_ends_at,auto_renew_consented,plan_snapshot,created_at").order("created_at", { ascending:false }).range(a,b)),
  ]);
  const selected = orders.filter((row) => (!filters.plan || planCode(row) === filters.plan) && (!filters.user || row.user_id === filters.user));
  const completed = new Set(selected.filter((row) => row.payment_purpose === "renewal" && row.completed_at).map((row) => row.user_id));
  const failed = new Set(selected.filter((row) => row.payment_purpose === "renewal" && row.failed_at).map((row) => row.user_id));
  const consentOnly = new Set(subscriptions.filter((row) => row.auto_renew_consented && !completed.has(row.user_id)).map((row) => row.user_id));
  const boundary = new Date(range.endUtcExclusive).getTime();
  const approaching = new Set(subscriptions.filter((row) => { const due = row.renewal_due_at ? new Date(row.renewal_due_at).getTime() : 0; return due >= boundary && due < boundary + 7*86400000; }).map((row) => row.user_id));
  const grace = new Set(subscriptions.filter((row) => row.status === "past_due" || row.grace_ends_at).map((row) => row.user_id));
  const allRows = [...completed].map((userId) => ({ userId, user: maskUserId(userId), completedRenewal: true, failedRenewal: failed.has(userId) }));
  if (exportAll && allRows.length > 10000) throw new Error("Recurring-customer exports are limited to 10,000 rows.");
  const rows = exportAll ? allRows : allRows.slice((filters.page-1)*filters.pageSize, filters.page*filters.pageSize);
  return { schemaVersion: REPORT_SCHEMA_VERSION, timezone: REPORT_TIMEZONE, effectiveRange: range, filters, counts: { recurringCustomers: completed.size, consentWithoutRenewal: consentOnly.size, failedRenewalCustomers: failed.size, approachingRenewal: approaching.size, graceOrPastDue: grace.size }, total: allRows.length, rows };
}

export async function getReconciliationReport(input: ReportInput, exportAll = false) {
  const { range, filters } = reportContext(input);
  const admin = createAdminClient();
  const stale = new Date(Date.now() - 2*60*60*1000).toISOString();
  const [cases, webhooks, pending, attention] = await Promise.all([
    admin.from("payment_exceptions").select("id,checkout_order_id,case_kind,status,amount_minor,currency,reason,created_at").eq("status","open").limit(10000),
    admin.from("webhook_events").select("id,provider,provider_event_id,status,received_at,error_message").in("status",["failed","rejected"]).gte("received_at",range.startUtc).lt("received_at",range.endUtcExclusive).limit(10000),
    admin.from("checkout_orders").select("id,user_id,status,amount_minor,currency,provider,created_at,attention_reason").eq("status","pending").lt("created_at",stale).limit(10000),
    admin.from("checkout_orders").select("id,user_id,status,provider_status,amount_minor,currency,provider,created_at,attention_reason").eq("reconciliation_state","attention").limit(10000),
  ]);
  for (const result of [cases,webhooks,pending,attention]) if (result.error) throw result.error;
  const rows:any[] = [
    ...(cases.data ?? []).map((row) => ({ id:`case:${row.id}`,kind:row.case_kind,status:row.status,orderId:row.checkout_order_id,amountMinor:row.amount_minor,currency:row.currency,reason:row.reason,createdAt:row.created_at })),
    ...(webhooks.data ?? []).map((row) => ({ id:`webhook:${row.id}`,kind:"failed_or_ignored_webhook",status:row.status,provider:row.provider,providerEventId:row.provider_event_id,reason:row.error_message,createdAt:row.received_at })),
    ...(pending.data ?? []).map((row) => ({ id:`stale:${row.id}`,kind:"stale_pending_payment",status:row.status,orderId:row.id,user:maskUserId(row.user_id),amountMinor:row.amount_minor,currency:row.currency,provider:row.provider,reason:row.attention_reason ?? "Pending payment exceeded two hours.",createdAt:row.created_at })),
    ...(attention.data ?? []).map((row) => ({ id:`attention:${row.id}`,kind:row.provider_status && row.provider_status !== row.status ? "provider_internal_status_mismatch" : "entitlement_or_linkage_attention",status:row.status,orderId:row.id,user:maskUserId(row.user_id),amountMinor:row.amount_minor,currency:row.currency,provider:row.provider,reason:row.attention_reason,createdAt:row.created_at })),
  ];
  rows.sort((a,b) => String(b.createdAt).localeCompare(String(a.createdAt)));
  if (exportAll && rows.length > 10000) throw new Error("Reconciliation exports are limited to 10,000 rows.");
  return { schemaVersion: REPORT_SCHEMA_VERSION, timezone: REPORT_TIMEZONE, effectiveRange: range, filters, threshold:{stalePendingHours:2}, page:exportAll?1:filters.page, pageSize:exportAll?rows.length:filters.pageSize, total:rows.length, rows:exportAll?rows:rows.slice((filters.page-1)*filters.pageSize,filters.page*filters.pageSize) };
}

export async function getBenefitCostReport(input: ReportInput) {
  const { range, filters } = reportContext(input);
  return { schemaVersion: REPORT_SCHEMA_VERSION, timezone: REPORT_TIMEZONE, effectiveRange: range, filters, supported:false, reason:"Jalwa Premium benefits have no approved monetary issue, redemption or reversal ledger.", metrics:null, rows:[] };
}
