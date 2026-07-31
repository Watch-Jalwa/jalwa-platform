import test from "node:test";
import assert from "node:assert/strict";
import {
  REPORT_SCHEMA_VERSION,
  calculatePremiumSummary,
  buildCsv,
  protectSpreadsheetCell,
  resolveReportRange,
} from "../lib/reports/premium.mjs";

const range = {
  preset: "custom",
  timezone: "Asia/Karachi",
  startDate: "2026-07-01",
  endDate: "2026-07-31",
  startUtc: "2026-06-30T19:00:00.000Z",
  endUtcExclusive: "2026-07-31T19:00:00.000Z",
  days: 31,
};

test("Karachi report presets use local midnight while storing UTC boundaries", () => {
  const today = resolveReportRange({ preset: "today" }, new Date("2026-07-31T15:30:00.000Z"));
  assert.equal(today.startDate, "2026-07-31");
  assert.equal(today.startUtc, "2026-07-30T19:00:00.000Z");
  assert.equal(today.endUtcExclusive, "2026-07-31T19:00:00.000Z");

  const previousMonth = resolveReportRange({ preset: "previousMonth" }, new Date("2026-07-31T15:30:00.000Z"));
  assert.equal(previousMonth.startDate, "2026-06-01");
  assert.equal(previousMonth.endDate, "2026-06-30");
});

test("summary keeps gross cash, refunds, net cash and MRR separate", () => {
  const orders = [
    { id: "activation", user_id: "u1", status: "succeeded", payment_purpose: "activation", amount_minor: 29900, completed_at: "2026-07-05T10:00:00.000Z", plan_snapshot: { code: "premium" } },
    { id: "renewal", user_id: "u1", status: "partially_refunded", payment_purpose: "renewal", amount_minor: 29900, completed_at: "2026-07-20T10:00:00.000Z", plan_snapshot: { code: "premium" } },
    { id: "failed-renewal", user_id: "u2", status: "failed", payment_purpose: "renewal", amount_minor: 29900, failed_at: "2026-07-21T10:00:00.000Z", created_at: "2026-07-21T09:59:00.000Z", plan_snapshot: { code: "premium" } },
  ];
  const attempts = [
    { checkout_order_id: "activation", status: "succeeded", created_at: "2026-07-05T10:00:00.000Z" },
    { checkout_order_id: "renewal", status: "succeeded", created_at: "2026-07-20T10:00:00.000Z" },
    { checkout_order_id: "failed-renewal", status: "failed", created_at: "2026-07-21T10:00:00.000Z" },
  ];
  const refunds = [{ checkout_order_id: "renewal", amount_minor: 9900, refunded_at: "2026-07-22T10:00:00.000Z" }];
  const subscriptions = [
    { user_id: "u1", status: "active", activation_source: "paid", current_period_end: "2026-08-31T19:00:00.000Z", price_snapshot: { amountMinor: 29900, billingPeriod: "month" }, auto_renew_consented: true },
    { user_id: "u3", status: "active", activation_source: "paid", current_period_end: "2027-07-31T19:00:00.000Z", price_snapshot: { amountMinor: 299900, billingPeriod: "year" }, auto_renew_consented: true },
    { user_id: "u4", status: "active", activation_source: "manual_grant", current_period_end: "2026-08-31T19:00:00.000Z", price_snapshot: { amountMinor: 999999, billingPeriod: "month" }, auto_renew_consented: false },
  ];
  const summary = calculatePremiumSummary({ orders, attempts, refunds, subscriptions, range, groupBy: "daily" });
  assert.equal(summary.schemaVersion, REPORT_SCHEMA_VERSION);
  assert.equal(summary.kpis.grossCollections, 59800);
  assert.equal(summary.kpis.refunds, 9900);
  assert.equal(summary.kpis.netCollections, 49900);
  assert.equal(summary.kpis.newPaidActivations, 1);
  assert.equal(summary.kpis.successfulRenewals, 1);
  assert.equal(summary.kpis.failedRenewals, 1);
  assert.equal(summary.kpis.renewalSuccessRate, 0.5);
  assert.equal(summary.kpis.recurringCustomers, 1);
  assert.equal(summary.kpis.autoRenewConsentedUsers, 2);
  assert.equal(summary.kpis.monthlyRecurringRevenue, 54892);
  assert.equal(summary.kpis.annualRecurringRevenue, 658704);
});

test("manual grants and consent-only customers are not recurring revenue", () => {
  const summary = calculatePremiumSummary({
    orders: [], attempts: [], refunds: [], range,
    subscriptions: [
      { user_id: "consent", status: "active", activation_source: "paid", current_period_end: "2026-08-31T19:00:00.000Z", auto_renew_consented: true, price_snapshot: { amountMinor: 29900, billingPeriod: "month" } },
      { user_id: "manual", status: "active", activation_source: "manual_grant", current_period_end: "2026-08-31T19:00:00.000Z", auto_renew_consented: false, price_snapshot: { amountMinor: 29900, billingPeriod: "month" } },
    ],
  });
  assert.equal(summary.kpis.recurringCustomers, 0);
  assert.equal(summary.kpis.autoRenewConsentedUsers, 1);
  assert.equal(summary.kpis.monthlyRecurringRevenue, 29900);
});

test("CSV export is UTF-8, escaped and protected from spreadsheet formulas", () => {
  assert.equal(protectSpreadsheetCell("=2+2"), "'=2+2");
  assert.equal(protectSpreadsheetCell("@SUM(A1:A2)"), "'@SUM(A1:A2)");
  const csv = buildCsv([{ user: "=HYPERLINK(\"https://example.test\")", note: "Urdu, اردو" }], [
    { label: "User", value: "user" },
    { label: "Note", value: "note" },
  ]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /'=HYPERLINK/);
  assert.match(csv, /"Urdu, اردو"/);
  assert.ok(csv.endsWith("\r\n"));
});

test("custom report ranges reject reversed and oversized selections", () => {
  assert.throws(() => resolveReportRange({ preset: "custom", start: "2026-08-01", end: "2026-07-01" }), /end date/);
  assert.throws(() => resolveReportRange({ preset: "custom", start: "2024-01-01", end: "2026-07-31" }), /366 days/);
});
