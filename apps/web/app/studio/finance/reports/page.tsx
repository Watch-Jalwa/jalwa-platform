/* eslint-disable @typescript-eslint/no-explicit-any */
import Link from "next/link";
import { requireStaff } from "@/lib/studio/auth";
import { roleHasCapability } from "@/lib/studio/capabilities";
import { getBenefitCostReport, getPaymentLedger, getPremiumSummary, getReconciliationReport, getRecurringCustomers, getSubscriptionLedger, reportContext } from "@/lib/studio/premium-reports";
import { formatMinor } from "@/lib/reports/premium.mjs";
import styles from "./reports.module.css";
import { EffectiveRange, EmptyState, ErrorPanel, ExportLink, KpiCard, Money, Rate, ReportFilters, ReportTabs, StatusPill, type ReportSearch } from "./report-ui";

export const metadata = { title: "Premium Reports" };
type SearchParams = Promise<ReportSearch>;

function fulfilled<T>(result: PromiseSettledResult<T>): T | null {
  return result.status === "fulfilled" ? result.value : null;
}

export default async function PremiumReportsPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const { profile } = await requireStaff();
  const canRead = roleHasCapability(profile.role, "premium:reports:read");
  const canExport = roleHasCapability(profile.role, "premium:reports:export");
  if (!canRead) return <div className={styles.page}><div className="section-heading"><div><span className="eyebrow">Finance</span><h1>Premium reports</h1></div></div><section className={styles.errorPanel} role="alert"><h2>Permission denied</h2><p>Your Studio role does not include Premium report access.</p></section></div>;

  let context;
  try { context = reportContext(params); }
  catch (error) {
    return <div className={styles.page}><div className="section-heading"><div><span className="eyebrow">Finance</span><h1>Premium reports</h1></div></div><ReportTabs active="summary" /><ReportFilters params={params} /><ErrorPanel title="Invalid report range" error={error} /></div>;
  }

  const previewParams = { ...params, page: "1", pageSize: "5" };
  const [summaryResult, paymentsResult, subscriptionsResult, recurringResult, reconciliationResult, benefitsResult] = await Promise.allSettled([
    getPremiumSummary(params),
    getPaymentLedger(previewParams),
    getSubscriptionLedger(previewParams),
    getRecurringCustomers(previewParams),
    getReconciliationReport(previewParams),
    getBenefitCostReport(params),
  ]);
  const summary = fulfilled(summaryResult);
  const payments = fulfilled(paymentsResult);
  const subscriptions = fulfilled(subscriptionsResult);
  const recurring = fulfilled(recurringResult);
  const reconciliation = fulfilled(reconciliationResult);
  const benefits = fulfilled(benefitsResult);
  const maxTrend = Math.max(1, ...(summary?.buckets ?? []).map((bucket: any) => Math.max(bucket.grossCollections, bucket.refunds)));

  return <div className={styles.page}>
    <div className="section-heading"><div><span className="eyebrow">Finance</span><h1>Premium reports</h1><p>Authoritative collections, renewals, subscriptions and reconciliation for Jalwa Premium.</p></div><div className={styles.actions}><Link className="button button-secondary" href="/studio/finance">Finance operations</Link><ExportLink type="summary" params={params} enabled={canExport} /></div></div>
    <ReportTabs active="summary" />
    <ReportFilters params={params} range={context.range} />
    {summary ? <>
      <EffectiveRange range={summary.effectiveRange} generatedAt={summary.generatedAt} />
      <div className={styles.kpiGrid}>
        <KpiCard label="Gross collections" value={<Money amount={summary.kpis.grossCollections} />} help="Captured cash before refunds." />
        <KpiCard label="Refunds" value={<Money amount={summary.kpis.refunds} />} help="Full and partial refunds recognized in-period." />
        <KpiCard label="Net collections" value={<Money amount={summary.kpis.netCollections} />} help="Gross collections minus refunds." />
        <KpiCard label="Payment success" value={<Rate value={summary.kpis.paymentSuccessRate} />} help={`${summary.kpis.completedPayments} completed · ${summary.kpis.failedPayments} failed · ${summary.kpis.pendingPayments} pending`} />
        <KpiCard label="New paid activations" value={summary.kpis.newPaidActivations.toLocaleString("en-PK")} help="Manual grants are excluded." />
        <KpiCard label="Successful renewals" value={summary.kpis.successfulRenewals.toLocaleString("en-PK")} help={`${summary.kpis.failedRenewals} failed renewals · ${summary.kpis.renewalSuccessRate === null ? "rate unavailable" : `${(summary.kpis.renewalSuccessRate * 100).toFixed(1)}% success`}`} />
        <KpiCard label="Active subscriptions" value={summary.kpis.activeSubscriptions.toLocaleString("en-PK")} help={`${summary.kpis.cancelAtPeriodEndSubscriptions} cancel at period end · ${summary.kpis.gracePeriodSubscriptions} grace`} />
        <KpiCard label="Recurring customers" value={summary.kpis.recurringCustomers.toLocaleString("en-PK")} help="Requires at least one completed renewal. Consent alone is excluded." />
        <KpiCard label="MRR" value={<Money amount={summary.kpis.monthlyRecurringRevenue} />} help={summary.kpis.mrrSupported ? "Normalized run-rate, not collected cash." : `${summary.kpis.mrrUnsupportedSubscriptions} legacy subscriptions lack a price snapshot.`} />
        <KpiCard label="ARR" value={<Money amount={summary.kpis.annualRecurringRevenue} />} help="MRR multiplied by twelve." />
        <KpiCard label="Reconciliation attention" value={summary.kpis.reconciliationAttention.toLocaleString("en-PK")} help={`${summary.kpis.disputes} disputed orders in the selected source set.`} />
        <KpiCard label="Cancelled / expired" value={`${summary.kpis.cancelledSubscriptions} / ${summary.kpis.expiredSubscriptions}`} help="Failed attempts are not automatically counted as lost subscribers." />
      </div>
      <div className={styles.gridTwo}>
        <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Collection and renewal trend</h2><p className={styles.metadata}>Backend-generated {summary.filters.groupBy} buckets.</p></div></div>{summary.buckets.length ? <div className={styles.trend}>{summary.buckets.map((bucket: any) => <div className={styles.trendRow} key={bucket.key}><span>{bucket.key}</span><div className={styles.barTrack} aria-hidden="true"><div className={styles.bar} style={{ width: `${Math.max(2, bucket.grossCollections / maxTrend * 100)}%` }} /></div><strong>{formatMinor(bucket.netCollections)} · {bucket.renewals} renewals</strong></div>)}</div> : <EmptyState>No completed collections match these filters.</EmptyState>}</section>
        <section className={styles.panel}><div className={styles.panelHeader}><h2>Plan breakdown</h2></div>{summary.planBreakdown.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>Plan</th><th>Gross</th><th>Refunds</th><th>Net</th><th>Activations</th><th>Renewals</th></tr></thead><tbody>{summary.planBreakdown.map((row: any) => <tr key={row.planCode}><td>{row.planCode}</td><td><Money amount={row.grossCollections} /></td><td><Money amount={row.refunds} /></td><td><Money amount={row.netCollections} /></td><td>{row.activations}</td><td>{row.renewals}</td></tr>)}</tbody></table></div> : <EmptyState>No plan totals are available for this period.</EmptyState>}</section>
      </div>
      <section className={styles.panel}><div className={styles.panelHeader}><div><h2>Metric definitions</h2><p className={styles.metadata}>Schema {summary.schemaVersion}. The browser displays these formulas; it does not invent them.</p></div></div><div className={styles.definitionList}>{Object.entries(summary.metricDefinitions).map(([key, definition]) => <details key={key}><summary>{key.replace(/([A-Z])/g, " $1")}</summary><p>{String(definition)}</p></details>)}</div></section>
    </> : <ErrorPanel title="Summary report unavailable" error={summaryResult.status === "rejected" ? summaryResult.reason : null} />}

    <div className={styles.gridTwo}>
      {payments ? <section className={styles.panel}><div className={styles.panelHeader}><h2>Latest payments</h2><Link href="/studio/finance/reports/payments">Open ledger</Link></div>{payments.rows.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>User</th><th>Purpose</th><th>Amount</th><th>Status</th></tr></thead><tbody>{payments.rows.map((row: any) => <tr key={row.id}><td>{row.user}</td><td>{row.purpose}</td><td><Money amount={row.amountMinor} currency={row.currency} /></td><td><StatusPill value={row.internalStatus} /></td></tr>)}</tbody></table></div> : <EmptyState>No payment rows match.</EmptyState>}</section> : <ErrorPanel title="Payment preview unavailable" error={paymentsResult.status === "rejected" ? paymentsResult.reason : null} />}
      {subscriptions ? <section className={styles.panel}><div className={styles.panelHeader}><h2>Latest subscriptions</h2><Link href="/studio/finance/reports/subscriptions">Open ledger</Link></div>{subscriptions.rows.length ? <div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>User</th><th>Plan</th><th>Status</th><th>Lifetime</th></tr></thead><tbody>{subscriptions.rows.map((row: any) => <tr key={row.id}><td>{row.user}</td><td>{row.plan}</td><td><StatusPill value={row.status} /></td><td><Money amount={row.lifetimeCollectedRevenueMinor} currency={row.currency} /></td></tr>)}</tbody></table></div> : <EmptyState>No subscription rows match.</EmptyState>}</section> : <ErrorPanel title="Subscription preview unavailable" error={subscriptionsResult.status === "rejected" ? subscriptionsResult.reason : null} />}
    </div>
    <div className={styles.gridTwo}>
      {recurring ? <section className={styles.panel}><div className={styles.panelHeader}><h2>Recurring-customer definition</h2><Link href="/studio/finance/reports/recurring">Open report</Link></div><p className={styles.callout}><strong>{recurring.counts.recurringCustomers}</strong> customers have completed a renewal. <strong>{recurring.counts.consentWithoutRenewal}</strong> have consent without a completed renewal and are reported separately.</p></section> : <ErrorPanel title="Recurring report unavailable" error={recurringResult.status === "rejected" ? recurringResult.reason : null} />}
      {reconciliation ? <section className={styles.panel}><div className={styles.panelHeader}><h2>Reconciliation attention</h2><Link href="/studio/finance/reports/reconciliation">Open queue</Link></div><p className={styles.callout}><strong>{reconciliation.total}</strong> read-only attention items. Mutations remain in Finance operations and require the reconciliation capability, a reason and audit evidence.</p></section> : <ErrorPanel title="Reconciliation report unavailable" error={reconciliationResult.status === "rejected" ? reconciliationResult.reason : null} />}
    </div>
    {benefits ? <section className={styles.panel}><div className={styles.panelHeader}><h2>Benefit cost</h2><Link href="/studio/finance/reports/benefits">Details</Link></div><p className={styles.callout}>{benefits.supported ? "Approved monetary benefit-cost data is available." : benefits.reason}</p></section> : <ErrorPanel title="Benefit-cost status unavailable" error={benefitsResult.status === "rejected" ? benefitsResult.reason : null} />}
  </div>;
}
