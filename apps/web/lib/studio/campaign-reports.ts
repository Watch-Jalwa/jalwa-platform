import { databasePool } from "@/lib/database/pool";
import { buildCampaignReport, karachiBounds } from "@/lib/reports/campaign.mjs";

export type CampaignFilters = {
  start: string; end: string; platform?: string; plan?: string;
  parameter?: string; landing?: string; referral?: string; campaign?: string; product?: string;
};
type PaymentRow = {
  provider: string; remotePaymentId: string; status: string; completedAt: string; amountMinor: number;
  product: string; source: string; planCode: string; parameter: string;
  landingPath: string; referral: string; campaign: string; verified: boolean; hasSubscription: boolean;
};
export function campaignFeatureEnabled() {
  return process.env.JALWA_CAMPAIGN_ANALYTICS_ENABLED === "true";
}
export function readCampaignFilters(params: URLSearchParams): CampaignFilters {
  const raw = (key: string, limit = 100) => (params.get(key) ?? "").trim().slice(0, limit);
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date());
  const end = raw("end", 10) || today;
  const start = raw("start", 10) || end;
  karachiBounds(start, end);
  return {
    start, end,
    platform: raw("platform") || undefined,
    plan: raw("plan") || undefined,
    parameter: raw("parameter") || undefined,
    landing: raw("landing") || undefined,
    referral: raw("referral") || undefined,
    campaign: raw("campaign") || undefined,
    product: raw("product") || undefined,
  };
}
export async function getCampaignPaidReport(filters: CampaignFilters) {
  if (!campaignFeatureEnabled()) throw new Error("Campaign analytics module is disabled.");
  const bounds = karachiBounds(filters.start, filters.end);
  const result = await databasePool.query<{
    provider: string; remote_payment_id: string; status: string;
    completed_at: Date; amount_minor: number; product: string;
    source: string; plan_code: string; parameter: string; landing_path: string;
    referral: string; campaign: string;
  }>(`
    select p.provider::text provider, p.remote_payment_id, p.status, 
      coalesce(p.remote_updated_at,p.remote_created_at) completed_at, p.amount_minor,
      coalesce(cfg.product,'jalwa') product,
      coalesce(a.source,'unknown') source,
      coalesce(a.plan_code,'unknown') plan_code,
      coalesce(a.parameter,'unknown') parameter,
      coalesce(a.landing_path,'unknown') landing_path,
      coalesce(a.referral,'unknown') referral,
      coalesce(a.utm_campaign,'unknown') campaign
    from public.payment_service_payments p
    left join public.campaign_payment_links l on l.provider=p.provider and l.remote_payment_id=p.remote_payment_id
    left join public.subscriptions s on s.id=l.subscription_id and s.user_id=p.user_id and s.provider=p.provider
    left join public.campaign_attributions a on a.id=l.attribution_id
    left join public.campaign_configs cfg on cfg.id=a.campaign_id
    where p.status='completed'
      and (p.charge_kind in ('full','step') or (s.id is not null
        and l.link_source in ('verified_payment_service','verified_jazzcash')))
      and coalesce(p.remote_updated_at,p.remote_created_at) >= $1::timestamptz
      and coalesce(p.remote_updated_at,p.remote_created_at) < $2::timestamptz
    order by p.remote_created_at asc, p.remote_payment_id asc
    limit 20001
  `,[bounds.startInclusiveUtc,bounds.endExclusiveUtc]);
  if (result.rows.length > 20000) throw new Error("Campaign report row limit exceeded; narrow the date range.");
  const records: PaymentRow[] = result.rows.map(p => ({
    provider:p.provider,remotePaymentId:p.remote_payment_id,status:p.status,
    completedAt:new Date(p.completed_at).toISOString(),amountMinor:p.amount_minor,
    product:p.product,source:p.source,planCode:p.plan_code,parameter:p.parameter,
    landingPath:p.landing_path,referral:p.referral,campaign:p.campaign,
    verified:true,hasSubscription:true,
  }));
  return buildCampaignReport(records, filters);
}
