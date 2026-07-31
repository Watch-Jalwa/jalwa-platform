import type { ReactNode } from "react";
import Link from "next/link";
import styles from "./reports.module.css";
import { formatMinor, type ReportRange } from "@/lib/reports/premium.mjs";

export type ReportSearch = Record<string, string | string[] | undefined>;

export function firstValue(value: string | string[] | undefined, fallback = "") {
  return typeof value === "string" ? value : Array.isArray(value) ? value[0] ?? fallback : fallback;
}

export function queryString(params: ReportSearch, overrides: Record<string, string | number | null> = {}) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    const first = firstValue(value);
    if (first) query.set(key, first);
  }
  for (const [key, value] of Object.entries(overrides)) {
    if (value === null || value === "") query.delete(key);
    else query.set(key, String(value));
  }
  const result = query.toString();
  return result ? `?${result}` : "";
}

export function ReportTabs({ active }: { active: string }) {
  const tabs: readonly [string, string, string][] = [
    ["summary", "/studio/finance/reports", "Summary"],
    ["payments", "/studio/finance/reports/payments", "Payments"],
    ["subscriptions", "/studio/finance/reports/subscriptions", "Subscriptions"],
    ["recurring", "/studio/finance/reports/recurring", "Recurring"],
    ["reconciliation", "/studio/finance/reports/reconciliation", "Reconciliation"],
    ["benefits", "/studio/finance/reports/benefits", "Benefit costs"],
  ];
  return <nav className={styles.tabs} aria-label="Premium report sections">{tabs.map(([id, href, label]) => <Link key={id} className={active === id ? styles.activeTab : styles.tab} href={href} aria-current={active === id ? "page" : undefined}>{label}</Link>)}</nav>;
}

export function ReportFilters({ params, range, compact = false }: { params: ReportSearch; range?: ReportRange; compact?: boolean }) {
  const preset = firstValue(params.preset, "last30");
  return <form className={styles.filters} method="get">
    <label>Period<select name="preset" defaultValue={preset}><option value="today">Today</option><option value="yesterday">Yesterday</option><option value="last7">Last 7 days</option><option value="last30">Last 30 days</option><option value="currentMonth">Current month</option><option value="previousMonth">Previous month</option><option value="custom">Custom</option></select></label>
    <label>Start<input type="date" name="start" defaultValue={firstValue(params.start, range?.startDate ?? "")} /></label>
    <label>End<input type="date" name="end" defaultValue={firstValue(params.end, range?.endDate ?? "")} /></label>
    <label>Grouping<select name="groupBy" defaultValue={firstValue(params.groupBy, "daily")}><option value="daily">Daily</option><option value="monthly">Monthly</option></select></label>
    <label>Plan<input name="plan" placeholder="premium" defaultValue={firstValue(params.plan)} /></label>
    {!compact ? <><label>Purpose<select name="purpose" defaultValue={firstValue(params.purpose, "all")}><option value="all">All purposes</option><option value="activation">Activation</option><option value="renewal">Renewal</option><option value="unknown">Legacy / unknown</option></select></label><label>Payment status<select name="paymentStatus" defaultValue={firstValue(params.paymentStatus, "all")}><option value="all">All payment states</option><option value="succeeded">Completed</option><option value="failed">Failed</option><option value="pending">Pending</option><option value="refunded">Refunded</option><option value="partially_refunded">Partially refunded</option><option value="disputed">Disputed</option><option value="expired">Expired</option></select></label><label>Subscription status<select name="subscriptionStatus" defaultValue={firstValue(params.subscriptionStatus, "all")}><option value="all">All subscription states</option><option value="active">Active</option><option value="past_due">Past due</option><option value="cancel_at_period_end">Cancel at period end</option><option value="cancelled">Cancelled</option><option value="expired">Expired</option></select></label></> : null}
    <button className="button button-primary" type="submit">Apply filters</button>
    <Link className="button button-secondary" href="?preset=last30&groupBy=daily">Reset</Link>
  </form>;
}

export function EffectiveRange({ range, generatedAt }: { range: ReportRange; generatedAt?: string }) {
  return <p className={styles.metadata}>Reporting boundary: <strong>{range.startDate}</strong> through <strong>{range.endDate}</strong> in <strong>{range.timezone}</strong>. UTC interval {range.startUtc} to {range.endUtcExclusive}{generatedAt ? ` · Generated ${new Date(generatedAt).toLocaleString("en-PK", { timeZone: range.timezone })}` : ""}.</p>;
}

export function KpiCard({ label, value, help }: { label: string; value: ReactNode; help?: string }) {
  return <article className={styles.kpi}><span>{label}</span><strong>{value}</strong>{help ? <small>{help}</small> : null}</article>;
}

export function Money({ amount, currency = "PKR" }: { amount: number; currency?: string }) {
  return <>{formatMinor(amount, currency)}</>;
}

export function Rate({ value }: { value: number | null | undefined }) {
  return <>{value === null || value === undefined ? "Not enough terminal attempts" : `${(value * 100).toFixed(1)}%`}</>;
}

export function ErrorPanel({ title, error }: { title: string; error: unknown }) {
  return <section className={styles.errorPanel} role="alert"><h2>{title}</h2><p>{error instanceof Error ? error.message : "This report section could not be loaded."}</p><p>Other report sections remain available. Adjust the filters or retry.</p></section>;
}

export function EmptyState({ children }: { children: ReactNode }) {
  return <div className={styles.empty}>{children}</div>;
}

export function ExportLink({ type, params, enabled = true }: { type: string; params: ReportSearch; enabled?: boolean }) {
  if (!enabled) return <span className={styles.disabledExport}>Export permission required</span>;
  return <a className="button button-secondary" href={`/api/studio/premium-reports/export/${type}${queryString(params, { page: null })}`}>Export CSV</a>;
}

export function Pagination({ basePath, params, page, pageSize, total }: { basePath: string; params: ReportSearch; page: number; pageSize: number; total: number }) {
  const pages = Math.max(1, Math.ceil(total / Math.max(1, pageSize)));
  return <nav className={styles.pagination} aria-label="Report pagination"><span>Page {page} of {pages} · {total.toLocaleString("en-PK")} rows</span><div>{page > 1 ? <Link className="button button-secondary" href={`${basePath}${queryString(params, { page: page - 1 })}`}>Previous</Link> : null}{page < pages ? <Link className="button button-secondary" href={`${basePath}${queryString(params, { page: page + 1 })}`}>Next</Link> : null}</div></nav>;
}

export function StatusPill({ value }: { value: string }) {
  return <span className={styles.status}>{value.replaceAll("_", " ")}</span>;
}
