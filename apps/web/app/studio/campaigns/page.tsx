import Link from "next/link";
import { requireStaff } from "@/lib/studio/auth";
import { campaignFeatureEnabled, getCampaignPaidReport, readCampaignFilters } from "@/lib/studio/campaign-reports";

export const metadata = { title: "Campaign Analytics · Jalwa Studio" };
type Search = Record<string, string | string[] | undefined>;

function urlParams(input: Search) {
  const out = new URLSearchParams();
  for (const [key, value] of Object.entries(input)) {
    const v = typeof value === "string" ? value : Array.isArray(value) ? value[0] : "";
    if (v) out.set(key, v);
  }
  return out;
}
function money(minor: number) {
  return "PKR " + (minor / 100).toLocaleString("en-PK", {maximumFractionDigits:2});
}
export default async function CampaignAnalyticsPage({searchParams}:{searchParams:Promise<Search>}) {
  const { profile } = await requireStaff();
  if (profile.role !== "admin" && profile.role !== "finance") {
    return <section className="panel"><h1>Permission denied</h1><p>Campaign reporting requires an authorized finance/admin account.</p></section>;
  }
  const query = urlParams(await searchParams);
  let report: Awaited<ReturnType<typeof getCampaignPaidReport>> | null = null;
  let error = "";
  let filters: ReturnType<typeof readCampaignFilters> | null = null;
  try {
    filters = readCampaignFilters(query);
    if (campaignFeatureEnabled()) report = await getCampaignPaidReport(filters);
  } catch {
    error = "Report unavailable. Check the date range, staging database migrations and campaign feature configuration.";
  }
  return <div>
    <div className="section-heading"><div><span className="eyebrow">Campaign analytics</span>
      <h1>Campaign Tracking & Analytics</h1>
      <p>Backend-verified paid subscriptions, by landing, campaign, platform, plan and parameter.</p></div>
      <div><Link className="button button-secondary" href="/studio/campaigns/manage">Campaign management</Link> <Link className="button button-secondary" href="/studio/finance/reports">Premium finance</Link></div></div>
    {!campaignFeatureEnabled() ? <div className="notice"><strong>Not activated:</strong> Campaign reporting is disabled until staging migrations, attribution linkage and QA are accepted. No fictitious counts are displayed.</div> : null}
    {error ? <div className="notice" role="alert">{error}</div> : null}
    <section className="panel">
      <h2>Filters</h2>
      <form method="get" className="inline-form">
        <label>Start <input type="date" name="start" defaultValue={filters?.start ?? query.get("start") ?? ""} /></label>
        <label>End <input type="date" name="end" defaultValue={filters?.end ?? query.get("end") ?? ""} /></label>
        <label>Product <input name="product" defaultValue={filters?.product ?? ""} /></label>
        <label>Platform <select name="platform" defaultValue={filters?.platform ?? ""}><option value="">All</option>{["TikTok","Meta","Snapchat","Google","Direct","Unknown"].map(x=><option key={x}>{x}</option>)}</select></label>
        <label>Plan <input name="plan" defaultValue={filters?.plan ?? ""} /></label>
        <label>Parameter/UTM <input name="parameter" defaultValue={filters?.parameter ?? ""} /></label>
        <label>Landing <input name="landing" defaultValue={filters?.landing ?? ""} /></label>
        <label>Referral <input name="referral" defaultValue={filters?.referral ?? ""} /></label>
        <label>Campaign <input name="campaign" defaultValue={filters?.campaign ?? ""} /></label>
        <button type="submit" className="button button-primary">Apply filters</button>
      </form>
    </section>
    {report ? <><p><Link className="button button-primary" href={"/api/studio/campaigns/export?"+query.toString()}>Download Excel (.xlsx)</Link></p>
      <div className="metric-grid">
        <article><strong>{report.totals.subs}</strong><span>Verified paid Subs</span></article>
        <article><strong>{money(report.totals.revenueMinor)}</strong><span>Verified gross collections</span></article>
      </div>
      <section className="panel">
        <h2>Date-wise Subs overview</h2>
        <p>Reference A — each date shows platform, plan and parameter views of the same paid subscriptions.</p>
        <div className="finance-table" style={{overflowX:"auto"}}>
          <table><thead>
            <tr><th rowSpan={2}>Date</th><th rowSpan={2}>Total Subs</th>
              {(["platform","plan","parameter"] as const).map(dim=><th key={dim} colSpan={Math.max(1,report.dimensions[dim].length)}>{dim === "platform" ? "Platform" : dim === "plan" ? "Plan IDs" : "Parameter / UTM"}</th>)}
            </tr>
            <tr>{(["platform","plan","parameter"] as const).flatMap(dim=>report.dimensions[dim].length
              ? report.dimensions[dim].map(item=><th key={dim+item.label}>{item.label}</th>)
              : [<th key={dim}>—</th>])}</tr></thead>
            <tbody>{report.dateWise.length ? report.dateWise.map(row=><tr key={row.date}>
              <td>{row.date}</td><td>{row.subs}</td>
              {(["platform","plan","parameter"] as const).flatMap(dim=>report.dimensions[dim].length
                ? report.dimensions[dim].map(item=><td key={dim+item.label}>{row[dim][item.label] ?? 0}</td>)
                : [<td key={dim}>—</td>])}
            </tr>) : <tr><td colSpan={5}>No verified attributed paid transactions in this range.</td></tr>}</tbody>
          </table>
        </div>
      </section>
      <section className="panel">
        <h2>Basic &amp; Detailed breakdown</h2>
        <p>Reference B — alternative groupings, not additive totals.</p>
        <div className="metric-grid">{(["platform","plan","parameter"] as const).map(dim=>
          <article key={dim}><h3>{dim === "platform" ? "Platform" : dim === "plan" ? "Plan ID" : "Parameter"}</h3>
            <table><thead><tr><th>{dim}</th><th>Subs</th></tr></thead>
              <tbody>{report.dimensions[dim].map(item=><tr key={item.label}><td>{item.label}</td><td>{item.subs}</td></tr>)}</tbody>
              <tfoot><tr><th>Total</th><th>{report.totals.subs}</th></tr></tfoot></table>
          </article>)}</div>
      </section>
      <p className="payment-fine-print">Subs count only reconciled, uniquely identified completed provider payments linked to a subscription. GA4 is not the payment source of truth. HE/MPIN remain unknown without provider definition.</p>
    </> : null}
  </div>;
}
