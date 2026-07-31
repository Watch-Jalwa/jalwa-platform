/* eslint-disable @typescript-eslint/no-explicit-any */
import { notFound } from "next/navigation";
import { requireStaff } from "@/lib/studio/auth";
import { roleHasCapability } from "@/lib/studio/capabilities";
import { getBenefitCostReport, getPaymentLedger, getReconciliationReport, getRecurringCustomers, getSubscriptionLedger, reportContext } from "@/lib/studio/premium-reports";
import styles from "../reports.module.css";
import { EffectiveRange, EmptyState, ErrorPanel, ExportLink, Money, Pagination, ReportFilters, ReportTabs, StatusPill, type ReportSearch } from "../report-ui";

export const metadata = { title: "Premium Report" };
type SearchParams = Promise<ReportSearch>;
type Params = Promise<{ section: string }>;

function date(value: string | null | undefined) {
  return value ? new Date(value).toLocaleString("en-PK", { timeZone: "Asia/Karachi" }) : "—";
}

export default async function PremiumReportSectionPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const { section } = await params;
  if (!new Set(["payments", "subscriptions", "recurring", "reconciliation", "benefits"]).has(section)) notFound();
  const query = await searchParams;
  const { profile } = await requireStaff();
  const canRead = roleHasCapability(profile.role, "premium:reports:read");
  const canExport = roleHasCapability(profile.role, "premium:reports:export");
  if (!canRead) return <div className={styles.page}><div className="section-heading"><div><span className="eyebrow">Finance</span><h1>Premium reports</h1></div></div><ErrorPanel title="Permission denied" error={new Error("Your Studio role does not include Premium report access.")} /></div>;

  let context;
  try { context = reportContext(query); }
  catch (error) { return <div className={styles.page}><ReportTabs active={section} /><ReportFilters params={query} /><ErrorPanel title="Invalid report range" error={error} /></div>; }

  try {
    if (section === "payments") {
      const report = await getPaymentLedger(query);
      return <div className={styles.page}><Header title="Payment ledger" description="Server-paginated payment visibility with immutable plan snapshots and safe provider references." type="payments" query={query} canExport={canExport} /><ReportTabs active={section} /><ReportFilters params={query} range={context.range} /><EffectiveRange range={report.effectiveRange} />{report.rows.length ? <section className={styles.panel}><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>User</th><th>Plan</th><th>Purpose</th><th>Amount</th><th>Internal</th><th>Provider</th><th>Reference</th><th>Completed / failed</th><th>Reconciliation</th></tr></thead><tbody>{report.rows.map((row: any) => <tr key={row.id}><td>{row.user}</td><td>{row.plan}<br /><small>{row.priceCode}</small></td><td>{row.purpose}</td><td><Money amount={row.amountMinor} currency={row.currency} /></td><td><StatusPill value={row.internalStatus} /></td><td>{row.provider}<br /><small>{row.providerStatus}</small></td><td>{row.providerOrderReference ?? "—"}</td><td>{date(row.completedAt || row.failedAt)}</td><td className={styles.wrap}><StatusPill value={row.reconciliationState} />{row.attentionReason ? <><br /><small>{row.attentionReason}</small></> : null}</td></tr>)}</tbody></table></div><Pagination basePath="/studio/finance/reports/payments" params={query} page={report.page} pageSize={report.pageSize} total={report.total} /></section> : <EmptyState>No payments match the selected filters.</EmptyState>}</div>;
    }

    if (section === "subscriptions") {
      const report = await getSubscriptionLedger(query);
      return <div className={styles.page}><Header title="Subscription ledger" description="Paid and manual-grant origins, lifecycle dates, renewal counts and lifetime collected revenue." type="subscriptions" query={query} canExport={canExport} /><ReportTabs active={section} /><ReportFilters params={query} range={context.range} /><EffectiveRange range={report.effectiveRange} />{report.rows.length ? <section className={styles.panel}><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>User</th><th>Plan</th><th>Status</th><th>Origin</th><th>Period / renewal</th><th>Cancellation / grace</th><th>Payments</th><th>Lifetime collected</th></tr></thead><tbody>{report.rows.map((row: any) => <tr key={row.id}><td>{row.user}</td><td>{row.plan}<br /><small>{row.priceCode}</small></td><td><StatusPill value={row.status} /></td><td>{row.activationSource}</td><td>{date(row.currentPeriodStart)}<br />to {date(row.currentPeriodEnd)}<br /><small>Due {date(row.renewalDueAt)}</small></td><td className={styles.wrap}>{row.cancelAtPeriodEnd ? "Cancel at period end" : "No cancellation scheduled"}<br /><small>Requested {date(row.cancellationRequestedAt)} · Grace {date(row.graceEndsAt)}</small></td><td>{row.successfulActivationCount} activations<br />{row.successfulRenewalCount} successful renewals<br />{row.failedRenewalCount} failed renewals</td><td><Money amount={row.lifetimeCollectedRevenueMinor} currency={row.currency} /></td></tr>)}</tbody></table></div><Pagination basePath="/studio/finance/reports/subscriptions" params={query} page={report.page} pageSize={report.pageSize} total={report.total} /></section> : <EmptyState>No subscriptions match the selected filters.</EmptyState>}</div>;
    }

    if (section === "recurring") {
      const report = await getRecurringCustomers(query);
      return <div className={styles.page}><Header title="Recurring customers" description="A recurring customer requires at least one completed renewal payment. Auto-renew consent remains separate." type="recurring" query={query} canExport={canExport} /><ReportTabs active={section} /><ReportFilters params={query} range={context.range} compact /><EffectiveRange range={report.effectiveRange} /><div className={styles.kpiGrid}>{Object.entries(report.counts).map(([label, value]) => <article className={styles.kpi} key={label}><span>{label.replace(/([A-Z])/g, " $1")}</span><strong>{Number(value).toLocaleString("en-PK")}</strong></article>)}</div>{report.rows.length ? <section className={styles.panel}><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>User</th><th>Completed renewal</th><th>Failed renewal</th></tr></thead><tbody>{report.rows.map((row: any) => <tr key={row.userId}><td>{row.user}</td><td>{row.completedRenewal ? "Yes" : "No"}</td><td>{row.failedRenewal ? "Yes" : "No"}</td></tr>)}</tbody></table></div><Pagination basePath="/studio/finance/reports/recurring" params={query} page={report.filters.page} pageSize={report.filters.pageSize} total={report.total} /></section> : <EmptyState>No customer has completed a renewal under these filters.</EmptyState>}</div>;
    }

    if (section === "reconciliation") {
      const report = await getReconciliationReport(query);
      return <div className={styles.page}><Header title="Reconciliation attention" description="Read-only mismatches and stale states. Resolve cases through Finance operations with a reason and audit trail." type="reconciliation" query={query} canExport={canExport} /><ReportTabs active={section} /><ReportFilters params={query} range={context.range} compact /><EffectiveRange range={report.effectiveRange} /><p className={styles.callout}>Pending payments enter this report after <strong>{report.threshold.stalePendingHours} hours</strong>. Report generation never mutates payments, renewals or entitlements.</p>{report.rows.length ? <section className={styles.panel}><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Kind</th><th>Status</th><th>Order</th><th>User</th><th>Amount</th><th>Provider</th><th>Reason</th><th>Created</th></tr></thead><tbody>{report.rows.map((row: any) => <tr key={row.id}><td>{row.kind.replaceAll("_", " ")}</td><td><StatusPill value={row.status} /></td><td>{row.orderId ?? "—"}</td><td>{row.user ?? "—"}</td><td>{row.amountMinor === null || row.amountMinor === undefined ? "—" : <Money amount={row.amountMinor} currency={row.currency ?? "PKR"} />}</td><td>{row.provider ?? "—"}</td><td className={styles.wrap}>{row.reason ?? "Operational review required."}</td><td>{date(row.createdAt)}</td></tr>)}</tbody></table></div><Pagination basePath="/studio/finance/reports/reconciliation" params={query} page={report.page} pageSize={report.pageSize} total={report.total} /></section> : <EmptyState>No reconciliation exceptions require attention.</EmptyState>}</div>;
    }

    const report = await getBenefitCostReport(query);
    return <div className={styles.page}><Header title="Benefit costs" description="Monetary issue, redemption and reversal reporting is shown only when authoritative values exist." type="benefits" query={query} canExport={canExport && report.supported} /><ReportTabs active={section} /><ReportFilters params={query} range={context.range} compact /><EffectiveRange range={report.effectiveRange} /><section className={styles.panel}><h2>{report.supported ? "Benefit-cost ledger" : "Not configured"}</h2><p className={styles.callout}>{report.reason}</p><p>Catalogue access, ad-free UI, playback quality, AI allowance, premium collections and early access do not receive invented rupee values.</p></section></div>;
  } catch (error) {
    return <div className={styles.page}><ReportTabs active={section} /><ReportFilters params={query} range={context.range} /><ErrorPanel title={`${section.replaceAll("_", " ")} report unavailable`} error={error} /></div>;
  }
}

function Header({ title, description, type, query, canExport }: { title: string; description: string; type: string; query: ReportSearch; canExport: boolean }) {
  return <div className="section-heading"><div><span className="eyebrow">Premium reports</span><h1>{title}</h1><p>{description}</p></div><ExportLink type={type} params={query} enabled={canExport} /></div>;
}
