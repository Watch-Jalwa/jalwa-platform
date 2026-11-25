import Link from "next/link";
import { requireStaff } from "@/lib/studio/auth";
import { createAdminClient } from "@/lib/database/admin";
import { createCampaign, changeCampaignState } from "../actions";
import { campaignLink } from "@/lib/landing/campaign-links.mjs";

export const metadata = {title:"Campaign Management · Jalwa Studio"};
type Campaign = {id:string;name:string;product:string;landing_path:string;source:string;
  plan_code:string;parameter:string;utm_campaign:string;referral:string;is_active:boolean};

export default async function ManageCampaignsPage() {
  const {profile}=await requireStaff();
  if(profile.role!=="admin") return <section className="panel"><h1>Permission denied</h1></section>;
  const enabled=process.env.JALWA_CAMPAIGN_ANALYTICS_ENABLED==="true";
  let campaigns:Campaign[]=[];
  let prices:Array<{code:string}>=[];
  if(enabled) {
    const db=createAdminClient();
    const [a,b]=await Promise.all([
      db.from("campaign_configs").select("id,name,product,landing_path,source,plan_code,parameter,utm_campaign,referral,is_active").order("created_at",{ascending:false}).limit(100),
      db.from("prices").select("code").eq("is_active",true).order("code"),
    ]);
    if(a.error || b.error) throw new Error("Campaign config migration or price catalogue is unavailable.");
    campaigns=(a.data ?? []) as Campaign[];
    prices=b.data ?? [];
  }
  return <div>
    <div className="section-heading"><div><span className="eyebrow">Campaign analytics</span>
      <h1>Campaign Management</h1><p>Configure campaign links within existing Jalwa Studio.</p></div>
      <Link className="button button-secondary" href="/studio/campaigns">View reports</Link></div>
    {!enabled ? <div className="notice">Campaign management is disabled until staging schema and QA are certified.</div> : <>
      <section className="panel">
        <h2>Create campaign</h2>
        <p>New campaigns start disabled. Only active server price codes can be selected; URL parameters never change prices.</p>
        <form action={createCampaign} className="inline-form">
          <label>Name <input name="name" required minLength={2} maxLength={160}/></label>
          <label>Product <input name="product" defaultValue="jalwa"/></label>
          <label>Landing path <input name="landing_path" defaultValue="/mainLanding" required/></label>
          <label>Platform <select name="source" required>{["TikTok","Meta","Snapchat","Google","Direct"].map(x=><option key={x}>{x}</option>)}</select></label>
          <label>Plan/price code <select name="plan_code" required>{prices.map(x=><option key={x.code} value={x.code}>{x.code}</option>)}</select></label>
          <label>UTM campaign <input name="utm_campaign"/></label>
          <label>UTM medium <input name="utm_medium"/></label>
          <label>Parameter <input name="parameter"/></label>
          <label>Referral <input name="referral"/></label>
          <label>Creative ID <input name="creative_id"/></label>
          <button className="button button-primary" type="submit" disabled={!prices.length}>Create disabled campaign</button>
        </form>
      </section>
      <section className="panel">
        <h2>Campaigns</h2>
        <div className="finance-table">
          <table><thead><tr><th>Name</th><th>Landing</th><th>Platform</th><th>Plan</th><th>Parameter</th><th>Campaign link</th><th>Status</th><th>Action</th></tr></thead>
            <tbody>{campaigns.map(c=><tr key={c.id}>
              <td>{c.name}</td><td>{c.landing_path}</td><td>{c.source}</td><td>{c.plan_code}</td><td>{c.parameter||"—"}</td>
              <td>{campaignLink(c) ? <input readOnly aria-label={"Link for "+c.name} value={campaignLink(c) ?? ""} size={44} /> : "Plan mapping required"}</td>
              <td>{c.is_active?"Active":"Disabled"}</td><td>
              <form action={changeCampaignState}><input type="hidden" name="campaign_id" value={c.id}/>
                <button type="submit" name="enabled" value={String(!c.is_active)} className="button button-secondary">
                  {c.is_active?"Disable":"Activate"}</button></form></td>
              </tr>)}</tbody>
          </table>
        </div>
      </section>
    </>}
  </div>;
}
