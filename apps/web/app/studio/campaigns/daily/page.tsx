import Link from "next/link";
import { requireStaff } from "@/lib/studio/auth";
import { createAdminClient } from "@/lib/database/admin";
import { getCampaignDailySummary, previousKarachiDay } from "@/lib/studio/campaign-daily";
import { saveCampaignDigestSettings } from "./actions";

export const metadata={title:"Campaign Daily Logs · Jalwa Studio"};
type Query=Promise<Record<string,string|string[]|undefined>>;
type Settings={
 enabled:boolean;timezone:string;delivery_hour:number;delivery_minute:number;recipient_emails:string[];
};
export default async function CampaignDailyPage({searchParams}:{searchParams:Query}) {
  const {profile}=await requireStaff();
  if(profile.role!=="admin"&&profile.role!=="finance")
    return <section className="panel"><h1>Permission denied</h1></section>;
  const enabled=process.env.JALWA_CAMPAIGN_ANALYTICS_ENABLED==="true";
  const query=await searchParams;
  const date=typeof query.date==="string"?query.date:previousKarachiDay();
  let report:Awaited<ReturnType<typeof getCampaignDailySummary>>|null=null;
  let settings:Settings|null=null;
  let error="";
  try{
    if(enabled) {
      report=await getCampaignDailySummary(date);
      if(profile.role==="admin"){
        const res=await createAdminClient().from("campaign_report_settings")
          .select("enabled,timezone,delivery_hour,delivery_minute,recipient_emails").eq("id",true).single();
        if(res.error)throw res.error;
        settings=res.data as Settings;
      }
    }
  }catch{error="Daily log unavailable. Verify staging migrations and the requested date.";}
  return <div>
    <div className="section-heading"><div><span className="eyebrow">Campaign analytics</span>
      <h1>Daily JazzCash Logs</h1>
      <p>Backend-verified payment summaries, PKT date boundaries and restricted daily email delivery.</p></div>
      <Link className="button button-secondary" href="/studio/campaigns">Campaign reports</Link></div>
    {!enabled?<div className="notice">Campaign reporting is disabled until staging acceptance.</div>:null}
    {error?<div className="notice" role="alert">{error}</div>:null}
    <section className="panel"><h2>Report day</h2><form method="get" className="inline-form">
      <label>Date (PKT) <input type="date" name="date" defaultValue={date}/></label>
      <button className="button button-secondary" type="submit">Load log</button></form></section>
    {report ? <>
      <div className="metric-grid">
        <article><strong>{report.landingViews}</strong><span>Landing views</span></article>
        <article><strong>{report.uniqueLandingVisitors}</strong><span>Unique identifiable visitors</span></article>
        <article><strong>{report.paywallVisits}</strong><span>Paywall visits</span></article>
        <article><strong>{report.successCount}</strong><span>Verified JazzCash successes</span></article>
        <article><strong>{report.failureCount}</strong><span>JazzCash failures</span></article>
      </div>
      <section className="panel"><h2>Payment-stage breakdown</h2>
        <table><tbody>
          <tr><th>HE traffic</th><td>Unknown — classification not provided</td></tr>
          <tr><th>NON HE traffic</th><td>Unknown — classification not provided</td></tr>
          <tr><th>Unknown HE traffic</th><td>{report.unknownHeTraffic}</td></tr>
          <tr><th>Unique paywall visits</th><td>{report.uniquePaywallVisits}</td></tr>
          <tr><th>MPIN stage</th><td>{report.mpinCount??"Not observable from provider"}</td></tr>
          <tr><th>Successful payment value</th><td>PKR {(report.successAmountMinor/100).toLocaleString("en-PK")}</td></tr>
        </tbody></table>
        <h3>Payment failure reasons</h3>
        <table><thead><tr><th>Code</th><th>Reason</th><th>Attempts</th></tr></thead><tbody>
          {report.failureReasons.map((x,i)=><tr key={x.code+"-"+i}><td>{x.code}</td><td>{x.reason}</td><td>{x.count}</td></tr>)}
        </tbody></table>
      </section>
      <p className="payment-fine-print">Generated {report.generatedAt}. Unknown MPIN/HE is never represented as zero. No customer numbers, OTPs or payment tokens appear here.</p>
    </>:null}
    {profile.role==="admin"&&settings?<section className="panel">
      <h2>Automated daily email settings</h2>
      <p>Disabled unless a staging operator separately enables outbound email. This form never enables production messaging.</p>
      <form action={saveCampaignDigestSettings} className="inline-form">
        <label>Recipients (comma separated)
          <textarea name="recipients" defaultValue={settings.recipient_emails.join(", ")} rows={3} /></label>
        <label>Hour (PKT) <input type="number" name="hour" min={0} max={23} defaultValue={settings.delivery_hour}/></label>
        <label>Minute (PKT) <input type="number" name="minute" min={0} max={59} defaultValue={settings.delivery_minute}/></label>
        <label><input type="checkbox" name="enabled" defaultChecked={settings.enabled}/> Enable staging delivery</label>
        <button className="button button-primary" type="submit">Save schedule</button>
      </form>
    </section>:null}
  </div>;
}
