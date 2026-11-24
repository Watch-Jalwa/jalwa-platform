// Pure campaign analytics metrics; no browser events may assert a paid conversion.
// Backend must supply rows from verified payment_service_payments joined via campaign_payment_links.
const DAY_MS = 86_400_000;
export const REPORT_TIMEZONE = "Asia/Karachi";
export const UNKNOWN = "Unknown";

export function normalizePlatform(source) {
  const s = String(source ?? "").trim().toLowerCase();
  if (s === "t" || s === "tiktok" || s === "tik tok") return "TikTok";
  if (s === "m" || s === "meta" || s === "facebook" || s === "instagram" || s === "fb" || s === "ig") return "Meta";
  if (s === "s" || s === "snapchat" || s === "snap") return "Snapchat";
  if (s === "g" || s === "google" || s === "google ads") return "Google";
  if (s === "d" || s === "direct" || s === "organic") return "Direct";
  return UNKNOWN;
}

export function karachiDay(instant) {
  const d = new Date(instant);
  if (!Number.isFinite(d.getTime())) throw new Error("Invalid report timestamp");
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
  }).format(d);
}

export function assertDay(day) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day) || new Date(day + "T00:00:00.000Z").toISOString().slice(0, 10) !== day) {
    throw new Error("Invalid YYYY-MM-DD report day");
  }
  return day;
}

export function karachiBounds(start, end) {
  assertDay(start); assertDay(end);
  const from = Date.parse(start + "T00:00:00.000Z") - 5 * 60 * 60 * 1000;
  const to = Date.parse(end + "T00:00:00.000Z") - 5 * 60 * 60 * 1000 + DAY_MS;
  if (from >= to || to - from > 367 * DAY_MS) throw new Error("Report range must be 1–366 days");
  return { startInclusiveUtc: new Date(from).toISOString(), endExclusiveUtc: new Date(to).toISOString() };
}

function name(value) {
  const s = String(value ?? "").trim();
  return s ? s.slice(0, 120) : UNKNOWN;
}

export function filterCompletedTransactions(rows, filters = {}) {
  const seen = new Set();
  return rows.filter(row => {
    if (row.status !== "completed" || row.verified !== true || row.hasSubscription !== true) return false;
    const id = String(row.provider ?? "") + ":" + String(row.remotePaymentId ?? "");
    if (!row.remotePaymentId || seen.has(id)) return false;
    seen.add(id);
    if (filters.product && name(row.product) !== filters.product) return false;
    if (filters.platform && normalizePlatform(row.source) !== filters.platform) return false;
    if (filters.plan && name(row.planCode) !== filters.plan) return false;
    if (filters.parameter && name(row.parameter) !== filters.parameter) return false;
    if (filters.landing && name(row.landingPath) !== filters.landing) return false;
    if (filters.referral && name(row.referral) !== filters.referral) return false;
    if (filters.campaign && name(row.campaign) !== filters.campaign) return false;
    if (filters.start && karachiDay(row.completedAt) < filters.start) return false;
    if (filters.end && karachiDay(row.completedAt) > filters.end) return false;
    return true;
  });
}

export function buildCampaignReport(rows, filters = {}) {
  const transactions = filterCompletedTransactions(rows, filters);
  const matrix = new Map();
  const dimensions = { platform: new Map(), plan: new Map(), parameter: new Map() };
  let totalRevenueMinor = 0;

  const inc = (map, key, value) => map.set(key, (map.get(key) ?? 0) + value);
  for (const row of transactions) {
    const day = karachiDay(row.completedAt);
    const platform = normalizePlatform(row.source);
    const plan = name(row.planCode);
    const parameter = name(row.parameter);
    const amountMinor = Number(row.amountMinor);
    if (!Number.isSafeInteger(amountMinor) || amountMinor < 0) throw new Error("Invalid verified payment amount");
    totalRevenueMinor += amountMinor;
    for (const [key, value] of [["platform", platform], ["plan", plan], ["parameter", parameter]]) {
      inc(dimensions[key], value, 1);
    }
    if (!matrix.has(day)) matrix.set(day, {
      date: day, subs: 0, revenueMinor: 0, platform: {}, plan: {}, parameter: {},
    });
    const bucket = matrix.get(day);
    bucket.subs += 1;
    bucket.revenueMinor += amountMinor;
    for (const [dimension, value] of [["platform", platform], ["plan", plan], ["parameter", parameter]]) {
      bucket[dimension][value] = (bucket[dimension][value] ?? 0) + 1;
    }
  }
  const toRows = map => [...map].sort((a,b) => b[1] - a[1] || a[0].localeCompare(b[0])).map(([label, subs]) => ({ label, subs }));
  return {
    timezone: REPORT_TIMEZONE,
    filters,
    totals: { subs: transactions.length, revenueMinor: totalRevenueMinor },
    dimensions: {
      platform: toRows(dimensions.platform),
      plan: toRows(dimensions.plan),
      parameter: toRows(dimensions.parameter),
    },
    dateWise: [...matrix.values()].sort((a,b) => a.date.localeCompare(b.date)),
    definitions: {
      subs: "Unique verified completed paid transactions linked to a subscription; other payment statuses excluded.",
      groupings: "Platform, plan and parameter are separate views of the same transactions.",
      he: "Unknown pending authoritative HE classification.",
      mpin: "Not observable unless provider supplies verified stage telemetry.",
    },
  };
}

export function buildDailyEventCounts(events, day) {
  assertDay(day);
  const scoped = events.filter(event => karachiDay(event.occurredAt) === day);
  const ofType = eventName => scoped.filter(e => e.eventName === eventName);
  const unique = items => new Set(items.map(e => e.anonymousId ?? e.sessionId).filter(Boolean)).size;
  const landing = ofType("landing_view");
  const checkout = ofType("begin_checkout");
  const mpin = ofType("mpin_stage_observed").filter(e => e.source === "provider");
  return {
    date: day, timezone: REPORT_TIMEZONE,
    landingViews: landing.length,
    uniqueLandingVisitors: unique(landing),
    paywallVisits: checkout.length,
    uniquePaywallVisits: unique(checkout),
    heTraffic: null, nonHeTraffic: null, unknownHeTraffic: landing.length,
    mpinCount: mpin.length ? mpin.length : null,
    mpinObservable: mpin.length > 0,
    note: "A null MPIN value is not zero. No provider telemetry is inferred.",
  };
}
