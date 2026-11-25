import { databasePool } from "@/lib/database/pool";
import { assertDay, karachiBounds } from "@/lib/reports/campaign.mjs";
import { campaignFeatureEnabled } from "@/lib/studio/campaign-reports";

type DailyAgg = {
  landing_views: string; unique_landing_visitors:string;
  checkout_visits:string;unique_checkout_visits:string;
  mpin_events:string;
};
type PayAgg = {status:string;response_code:string|null;response_message:string|null;count:string;amount_minor:string};
export function previousKarachiDay(now=new Date()) {
  const date=new Intl.DateTimeFormat("en-CA",{
    timeZone:"Asia/Karachi",year:"numeric",month:"2-digit",day:"2-digit",
  }).format(now);
  assertDay(date);
  return new Date(Date.parse(date+"T00:00:00Z")-86400000).toISOString().slice(0,10);
}
export async function getCampaignDailySummary(day:string) {
  if(!campaignFeatureEnabled()) throw new Error("Campaign analytics module is disabled.");
  const {startInclusiveUtc,endExclusiveUtc}=karachiBounds(day,day);
  const [events,payments] = await Promise.all([
    databasePool.query<DailyAgg>(`
      select
        count(*) filter(where event_name='landing_view')::text landing_views,
        count(distinct coalesce(anonymous_id::text,session_id))
          filter(where event_name='landing_view')::text unique_landing_visitors,
        count(*) filter(where event_name='begin_checkout')::text checkout_visits,
        count(distinct coalesce(anonymous_id::text,session_id))
          filter(where event_name='begin_checkout')::text unique_checkout_visits,
        count(*) filter(where event_name='mpin_stage_observed' and source='provider')::text mpin_events
      from public.campaign_events
      where occurred_at >= $1::timestamptz and occurred_at < $2::timestamptz
    `,[startInclusiveUtc,endExclusiveUtc]),
    databasePool.query<PayAgg>(`
      select status,coalesce(response_code,'Unmapped') response_code,
        'Unmapped (code-only; provider reason mapping pending)'::text response_message,
        count(*)::text count,coalesce(sum(amount_minor),0)::text amount_minor
      from public.payment_service_payments
      where provider='jazzcash' and coalesce(remote_updated_at,remote_created_at) >= $1::timestamptz
        and coalesce(remote_updated_at,remote_created_at) < $2::timestamptz
      group by status,coalesce(response_code,'Unmapped')
    `,[startInclusiveUtc,endExclusiveUtc]),
  ]);
  const e=events.rows[0] ?? {landing_views:"0",unique_landing_visitors:"0",checkout_visits:"0",
    unique_checkout_visits:"0",mpin_events:"0"};
  const completed=payments.rows.filter(x=>x.status==="completed");
  const failed=payments.rows.filter(x=>x.status==="failed");
  return {
    date:day,timezone:"Asia/Karachi",generatedAt:new Date().toISOString(),
    landingViews:Number(e.landing_views),uniqueLandingVisitors:Number(e.unique_landing_visitors),
    paywallVisits:Number(e.checkout_visits),uniquePaywallVisits:Number(e.unique_checkout_visits),
    heTraffic:null,nonHeTraffic:null,unknownHeTraffic:Number(e.landing_views),
    mpinCount:Number(e.mpin_events)>0?Number(e.mpin_events):null,
    mpinObservable:Number(e.mpin_events)>0,
    successCount:completed.reduce((n,x)=>n+Number(x.count),0),
    successAmountMinor:completed.reduce((n,x)=>n+Number(x.amount_minor),0),
    failureCount:failed.reduce((n,x)=>n+Number(x.count),0),
    failureReasons:failed.map(x=>({code:x.response_code??"Unmapped",
      reason:x.response_message??"Unmapped",count:Number(x.count)})),
    definitions:{
      success:"Authoritative payment-service completed records, not client conversion events.",
      he:"Provider HE classification unavailable; all landing visits shown as unknown.",
      mpin:"Null unless provider-emitted MPIN stage is observed.",
      uniqueVisitors:"Only identifiers accepted with consent; unidentifiable traffic shown in visit total.",
    },
  };
}
