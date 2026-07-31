export const REPORT_TIMEZONE = "Asia/Karachi";
export const REPORT_SCHEMA_VERSION = "premium-reports-v1";
export const MAX_REPORT_DAYS = 366;
export const DEFAULT_PAGE_SIZE = 25;
export const MAX_PAGE_SIZE = 100;

export const METRIC_DEFINITIONS = {
  grossCollections: "Completed captured subscription payments in the effective period before refunds.",
  refunds: "Full and partial refund amounts recognized in the effective period.",
  netCollections: "Gross collections minus recognized refunds. MRR and ARR are not collected cash.",
  paymentAttempts: "Persisted provider payment attempts, excluding page views and button clicks.",
  paymentSuccessRate: "Completed terminal attempts divided by completed plus failed terminal attempts. Pending attempts are excluded.",
  newPaidActivations: "First completed paid activation for a customer-plan relationship, excluding manual grants.",
  successfulRenewals: "Completed payments explicitly classified as renewals.",
  failedRenewals: "Failed payment attempts linked to orders explicitly classified as renewals.",
  renewalSuccessRate: "Completed renewal attempts divided by completed plus failed terminal renewal attempts.",
  activeSubscriptions: "Paid subscriptions whose current status and effective period grant access at the report boundary.",
  gracePeriodSubscriptions: "Subscriptions with an authoritative grace end after the report boundary.",
  autoRenewConsentedUsers: "Users with stored auto-renew consent. Consent alone does not make a recurring customer.",
  recurringCustomers: "Customers with at least one completed renewal payment.",
  monthlyRecurringRevenue: "Normalized active paid run-rate: monthly amount plus annual amount divided by twelve. Passes and manual grants contribute zero.",
  annualRecurringRevenue: "Monthly recurring revenue multiplied by twelve.",
  lifetimeCollectedRevenue: "Completed subscription collections minus authoritative refunds for the customer.",
};

function dateKeyInKarachi(date) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function shiftDateKey(dateKey, days) {
  const [year, month, day] = dateKey.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return date.toISOString().slice(0, 10);
}

function startOfMonth(dateKey) {
  return `${dateKey.slice(0, 7)}-01`;
}

function startOfPreviousMonth(dateKey) {
  const [year, month] = dateKey.split("-").map(Number);
  return new Date(Date.UTC(year, month - 2, 1)).toISOString().slice(0, 10);
}

function toUtcBoundary(dateKey) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) throw new Error("Invalid report date.");
  const value = new Date(`${dateKey}T00:00:00+05:00`);
  if (Number.isNaN(value.getTime())) throw new Error("Invalid report date.");
  return value.toISOString();
}

export function resolveReportRange(input = {}, now = new Date()) {
  const today = dateKeyInKarachi(now);
  const preset = String(input.preset || "last30");
  let startDate;
  let endDateExclusive;

  if (preset === "today") {
    startDate = today;
    endDateExclusive = shiftDateKey(today, 1);
  } else if (preset === "yesterday") {
    startDate = shiftDateKey(today, -1);
    endDateExclusive = today;
  } else if (preset === "last7") {
    startDate = shiftDateKey(today, -6);
    endDateExclusive = shiftDateKey(today, 1);
  } else if (preset === "currentMonth") {
    startDate = startOfMonth(today);
    endDateExclusive = shiftDateKey(today, 1);
  } else if (preset === "previousMonth") {
    startDate = startOfPreviousMonth(today);
    endDateExclusive = startOfMonth(today);
  } else if (preset === "custom") {
    startDate = String(input.start || "");
    const inclusiveEnd = String(input.end || "");
    if (!startDate || !inclusiveEnd) throw new Error("Custom reports require start and end dates.");
    endDateExclusive = shiftDateKey(inclusiveEnd, 1);
  } else {
    startDate = shiftDateKey(today, -29);
    endDateExclusive = shiftDateKey(today, 1);
  }

  const startUtc = new Date(toUtcBoundary(startDate));
  const endUtc = new Date(toUtcBoundary(endDateExclusive));
  const days = Math.round((endUtc.getTime() - startUtc.getTime()) / 86400000);
  if (days < 1) throw new Error("Report end date must be on or after its start date.");
  if (days > MAX_REPORT_DAYS) throw new Error(`Report ranges are limited to ${MAX_REPORT_DAYS} days.`);

  return {
    preset,
    timezone: REPORT_TIMEZONE,
    startDate,
    endDate: shiftDateKey(endDateExclusive, -1),
    startUtc: startUtc.toISOString(),
    endUtcExclusive: endUtc.toISOString(),
    days,
  };
}

export function normalizeFilters(input = {}) {
  const value = (key) => {
    const raw = input[key];
    return raw === undefined || raw === null || raw === "" || raw === "all" ? null : String(raw);
  };
  const page = Math.max(1, Number.parseInt(String(input.page || "1"), 10) || 1);
  const pageSize = Math.min(MAX_PAGE_SIZE, Math.max(1, Number.parseInt(String(input.pageSize || DEFAULT_PAGE_SIZE), 10) || DEFAULT_PAGE_SIZE));
  const groupBy = value("groupBy") === "monthly" ? "monthly" : "daily";
  return {
    plan: value("plan"),
    purpose: value("purpose"),
    paymentStatus: value("paymentStatus"),
    providerStatus: value("providerStatus"),
    subscriptionStatus: value("subscriptionStatus"),
    reconciliationState: value("reconciliationState"),
    user: value("user"),
    reference: value("reference"),
    groupBy,
    page,
    pageSize,
  };
}

export function maskUserId(userId) {
  const value = String(userId || "");
  return value ? `Jalwa user ${value.slice(0, 8)}` : "Jalwa user";
}

function inRange(value, range) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return time >= new Date(range.startUtc).getTime() && time < new Date(range.endUtcExclusive).getTime();
}

function dateBucket(value, groupBy) {
  const key = dateKeyInKarachi(new Date(value));
  return groupBy === "monthly" ? key.slice(0, 7) : key;
}

function snapshotValue(snapshot, camel, snake) {
  return snapshot?.[camel] ?? snapshot?.[snake] ?? null;
}

function planCode(row) {
  return row.plan_snapshot?.code || row.price_snapshot?.planCode || "legacy-unknown";
}

function isCompletedOrder(order) {
  return Boolean(order.completed_at) && ["succeeded", "refunded", "partially_refunded", "disputed"].includes(order.status);
}

export function calculatePremiumSummary({ orders = [], attempts = [], refunds = [], subscriptions = [], range, groupBy = "daily" }) {
  const completedOrders = orders.filter((order) => isCompletedOrder(order) && inRange(order.completed_at, range));
  const periodRefunds = refunds.filter((refund) => inRange(refund.refunded_at, range));
  const periodAttempts = attempts.filter((attempt) => inRange(attempt.created_at, range));
  const orderById = new Map(orders.map((order) => [order.id, order]));

  const grossCollections = completedOrders.reduce((sum, order) => sum + Number(order.amount_minor || 0), 0);
  const refundedAmount = periodRefunds.reduce((sum, refund) => sum + Number(refund.amount_minor || 0), 0);
  const netCollections = grossCollections - refundedAmount;
  const completedAttempts = periodAttempts.filter((attempt) => attempt.status === "succeeded").length;
  const failedAttempts = periodAttempts.filter((attempt) => attempt.status === "failed").length;
  const pendingAttempts = periodAttempts.filter((attempt) => ["created", "pending"].includes(attempt.status)).length;
  const terminalAttempts = completedAttempts + failedAttempts;
  const paymentSuccessRate = terminalAttempts ? completedAttempts / terminalAttempts : null;

  const newPaidActivations = completedOrders.filter((order) => order.payment_purpose === "activation").length;
  const successfulRenewals = completedOrders.filter((order) => order.payment_purpose === "renewal").length;
  const failedRenewals = periodAttempts.filter((attempt) => {
    const order = orderById.get(attempt.checkout_order_id);
    return attempt.status === "failed" && order?.payment_purpose === "renewal";
  }).length;
  const renewalTerminal = successfulRenewals + failedRenewals;
  const renewalSuccessRate = renewalTerminal ? successfulRenewals / renewalTerminal : null;

  const boundary = new Date(range.endUtcExclusive).getTime();
  const activeSubscriptions = subscriptions.filter((subscription) => {
    const end = subscription.current_period_end ? new Date(subscription.current_period_end).getTime() : 0;
    return subscription.activation_source === "paid" && ["active", "cancel_at_period_end"].includes(subscription.status) && end >= boundary;
  });
  const gracePeriodSubscriptions = subscriptions.filter((subscription) => {
    const grace = subscription.grace_ends_at ? new Date(subscription.grace_ends_at).getTime() : 0;
    return grace >= boundary && subscription.status === "past_due";
  }).length;
  const autoRenewConsentedUsers = new Set(subscriptions.filter((subscription) => subscription.auto_renew_consented).map((subscription) => subscription.user_id)).size;
  const recurringCustomers = new Set(orders.filter((order) => isCompletedOrder(order) && order.payment_purpose === "renewal").map((order) => order.user_id)).size;

  let monthlyRecurringRevenue = 0;
  let mrrUnsupportedSubscriptions = 0;
  for (const subscription of activeSubscriptions) {
    const amount = Number(snapshotValue(subscription.price_snapshot, "amountMinor", "amount_minor") || 0);
    const billingPeriod = snapshotValue(subscription.price_snapshot, "billingPeriod", "billing_period");
    if (!amount || !billingPeriod) {
      mrrUnsupportedSubscriptions += 1;
      continue;
    }
    if (billingPeriod === "month") monthlyRecurringRevenue += amount;
    else if (billingPeriod === "year") monthlyRecurringRevenue += Math.round(amount / 12);
  }

  const buckets = new Map();
  const ensureBucket = (key) => {
    if (!buckets.has(key)) buckets.set(key, { key, grossCollections: 0, refunds: 0, netCollections: 0, activations: 0, renewals: 0 });
    return buckets.get(key);
  };
  for (const order of completedOrders) {
    const bucket = ensureBucket(dateBucket(order.completed_at, groupBy));
    bucket.grossCollections += Number(order.amount_minor || 0);
    if (order.payment_purpose === "activation") bucket.activations += 1;
    if (order.payment_purpose === "renewal") bucket.renewals += 1;
  }
  for (const refund of periodRefunds) ensureBucket(dateBucket(refund.refunded_at, groupBy)).refunds += Number(refund.amount_minor || 0);
  for (const bucket of buckets.values()) bucket.netCollections = bucket.grossCollections - bucket.refunds;

  const plans = new Map();
  for (const order of completedOrders) {
    const code = planCode(order);
    if (!plans.has(code)) plans.set(code, { planCode: code, grossCollections: 0, refunds: 0, netCollections: 0, activations: 0, renewals: 0 });
    const row = plans.get(code);
    row.grossCollections += Number(order.amount_minor || 0);
    if (order.payment_purpose === "activation") row.activations += 1;
    if (order.payment_purpose === "renewal") row.renewals += 1;
  }
  for (const refund of periodRefunds) {
    const order = orderById.get(refund.checkout_order_id);
    const code = order ? planCode(order) : "legacy-unknown";
    if (!plans.has(code)) plans.set(code, { planCode: code, grossCollections: 0, refunds: 0, netCollections: 0, activations: 0, renewals: 0 });
    plans.get(code).refunds += Number(refund.amount_minor || 0);
  }
  for (const row of plans.values()) row.netCollections = row.grossCollections - row.refunds;

  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    timezone: REPORT_TIMEZONE,
    effectiveRange: range,
    metricDefinitions: METRIC_DEFINITIONS,
    kpis: {
      grossCollections,
      refunds: refundedAmount,
      netCollections,
      paymentAttempts: periodAttempts.length,
      completedPayments: completedAttempts,
      failedPayments: failedAttempts,
      pendingPayments: pendingAttempts,
      paymentSuccessRate,
      newPaidActivations,
      successfulRenewals,
      failedRenewals,
      renewalSuccessRate,
      activeSubscriptions: activeSubscriptions.length,
      gracePeriodSubscriptions,
      autoRenewConsentedUsers,
      recurringCustomers,
      monthlyRecurringRevenue,
      annualRecurringRevenue: monthlyRecurringRevenue * 12,
      mrrSupported: mrrUnsupportedSubscriptions === 0,
      mrrUnsupportedSubscriptions,
      cancelledSubscriptions: subscriptions.filter((subscription) => subscription.status === "cancelled").length,
      expiredSubscriptions: subscriptions.filter((subscription) => subscription.status === "expired").length,
      cancelAtPeriodEndSubscriptions: subscriptions.filter((subscription) => subscription.cancel_at_period_end).length,
    },
    buckets: [...buckets.values()].sort((a, b) => a.key.localeCompare(b.key)),
    planBreakdown: [...plans.values()].sort((a, b) => a.planCode.localeCompare(b.planCode)),
  };
}

export function protectSpreadsheetCell(value) {
  if (value === null || value === undefined) return "";
  const text = typeof value === "object" ? JSON.stringify(value) : String(value);
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function csvCell(value) {
  const protectedValue = protectSpreadsheetCell(value);
  return /[",\n\r]/.test(protectedValue) ? `"${protectedValue.replaceAll('"', '""')}"` : protectedValue;
}

export function buildCsv(rows, columns) {
  const header = columns.map((column) => csvCell(column.label)).join(",");
  const lines = rows.map((row) => columns.map((column) => csvCell(typeof column.value === "function" ? column.value(row) : row[column.value])).join(","));
  return `\uFEFF${[header, ...lines].join("\r\n")}\r\n`;
}

export function formatMinor(amountMinor, currency = "PKR") {
  return new Intl.NumberFormat("en-PK", { style: "currency", currency, maximumFractionDigits: 0 }).format(Number(amountMinor || 0) / 100);
}
