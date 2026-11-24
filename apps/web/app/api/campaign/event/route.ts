import { NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";
import { databasePool } from "@/lib/database/pool";
import { requestRateKey, safeSessionId } from "@/lib/security/request-key";
import { normalizePlatform } from "@/lib/reports/campaign.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
const browserEvents = new Set(["landing_view","landing_cta","subscribe","begin_checkout"]);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
function value(value:unknown,max=80) {
  return typeof value==="string" ? value.trim().slice(0,max) : "";
}
export async function POST(request:Request) {
  if(process.env.JALWA_CAMPAIGN_ANALYTICS_ENABLED!=="true")
    return new NextResponse(null,{status:204});
  if(Number(request.headers.get("content-length")||0)>8192)
    return NextResponse.json({error:"Event too large"},{status:413});
  const b=await request.json().catch(()=>null) as Record<string,unknown>|null;
  if(!b || !browserEvents.has(String(b.eventName??"")) || !uuid.test(String(b.eventKey??"")))
    return NextResponse.json({error:"Invalid event"},{status:400});
  const path=value(b.landingPath,180);
  if(!/^\/[a-zA-Z0-9/_-]{0,170}$/.test(path))
    return NextResponse.json({error:"Invalid landing"},{status:400});
  const consent=b.consent===true;
  const anonymousId=consent && typeof b.anonymousId==="string" && uuid.test(b.anonymousId)
    ? b.anonymousId : null;
  if(consent && !anonymousId) return NextResponse.json({error:"Invalid anonymous ID"},{status:400});
  const sessionId=safeSessionId(b.sessionId);
  const db=await createClient();
  const {data:{user}}=await db.auth.getUser();
  const source=normalizePlatform(value(b.utmSource)||value(b.utm));
  const attrs={
    anonymous_id:anonymousId,user_id:user?.id??null,
    landing_path:path,source,utm_source:value(b.utmSource)||value(b.utm),
    utm_medium:value(b.utmMedium),utm_campaign:value(b.utmCampaign,120),
    utm_content:value(b.utmContent),legacy_utm:value(b.utm),
    package_code:value(b.package),plan_code:value(b.planCode),
    parameter:value(b.parameter),referral:value(b.ref),
    ga_client_id:consent && typeof b.gaClientId==="string" && /^[0-9]{1,20}\.[0-9]{1,20}$/.test(b.gaClientId) ? b.gaClientId : null,
  };
  const client=await databasePool.connect();
  try{
    await client.query("begin");
    const rate = await client.query<{hits:number}>(`
      insert into public.campaign_ingest_rate_limits(bucket_key,window_start,hits,updated_at)
      values($1,now(),1,now())
      on conflict(bucket_key) do update set
        hits=case when public.campaign_ingest_rate_limits.window_start <= now()-interval '1 hour'
          then 1 else public.campaign_ingest_rate_limits.hits+1 end,
        window_start=case when public.campaign_ingest_rate_limits.window_start <= now()-interval '1 hour'
          then now() else public.campaign_ingest_rate_limits.window_start end,
        updated_at=now()
      returning hits`,[requestRateKey(request,"campaign-event",anonymousId??sessionId)]);
    if ((rate.rows[0]?.hits ?? 1000)>120) {
      await client.query("rollback");
      return new NextResponse(null,{status:204});
    }
    let attributionId:string|null=null;
    if(consent && anonymousId){
      const record=await client.query<{id:string}>(`
        insert into public.campaign_attributions(
          anonymous_id,user_id,landing_path,source,utm_source,utm_medium,utm_campaign,utm_content,
          legacy_utm,package_code,plan_code,parameter,referral,consent_state,ga_client_id
        ) values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'granted',$14)
        on conflict (anonymous_id) where consent_state='granted' do update set
          user_id=coalesce(excluded.user_id,public.campaign_attributions.user_id),
          first_seen_at=case when public.campaign_attributions.expires_at<=now() then now() else public.campaign_attributions.first_seen_at end,
          expires_at=case when public.campaign_attributions.expires_at<=now() then now()+interval '30 days' else public.campaign_attributions.expires_at end,
          landing_path=case when public.campaign_attributions.expires_at<=now() then excluded.landing_path else public.campaign_attributions.landing_path end,
          source=case when public.campaign_attributions.expires_at<=now() then excluded.source else public.campaign_attributions.source end,
          utm_source=case when public.campaign_attributions.expires_at<=now() then excluded.utm_source else public.campaign_attributions.utm_source end,
          utm_medium=case when public.campaign_attributions.expires_at<=now() then excluded.utm_medium else public.campaign_attributions.utm_medium end,
          utm_campaign=case when public.campaign_attributions.expires_at<=now() then excluded.utm_campaign else public.campaign_attributions.utm_campaign end,
          utm_content=case when public.campaign_attributions.expires_at<=now() then excluded.utm_content else public.campaign_attributions.utm_content end,
          legacy_utm=case when public.campaign_attributions.expires_at<=now() then excluded.legacy_utm else public.campaign_attributions.legacy_utm end,
          package_code=case when public.campaign_attributions.expires_at<=now() then excluded.package_code else public.campaign_attributions.package_code end,
          plan_code=case when public.campaign_attributions.expires_at<=now() then excluded.plan_code else public.campaign_attributions.plan_code end,
          parameter=case when public.campaign_attributions.expires_at<=now() then excluded.parameter else public.campaign_attributions.parameter end,
          referral=case when public.campaign_attributions.expires_at<=now() then excluded.referral else public.campaign_attributions.referral end,
          ga_client_id=case when public.campaign_attributions.expires_at<=now() then excluded.ga_client_id else coalesce(public.campaign_attributions.ga_client_id,excluded.ga_client_id) end
        returning id`,
        [attrs.anonymous_id,attrs.user_id,attrs.landing_path,attrs.source,attrs.utm_source,
         attrs.utm_medium,attrs.utm_campaign,attrs.utm_content,attrs.legacy_utm,
         attrs.package_code,attrs.plan_code,attrs.parameter,attrs.referral,attrs.ga_client_id]);
      attributionId=record.rows[0]?.id??null;
    }
    await client.query(`
      insert into public.campaign_events(event_key,event_name,attribution_id,anonymous_id,user_id,
        session_id,landing_path,source,metadata)
      values($1,$2,$3,$4,$5,$6,$7,'browser',$8::jsonb)
      on conflict(event_key) do nothing`,
      [String(b.eventKey),String(b.eventName),attributionId,anonymousId,user?.id??null,sessionId,path,
       JSON.stringify(consent?{platform:source,plan:attrs.plan_code,parameter:attrs.parameter}:{consent:"unattributed"})]);
    await client.query("commit");
    return new NextResponse(null,{status:204});
  }catch{
    await client.query("rollback").catch(()=>{});
    return NextResponse.json({error:"Event could not be accepted"},{status:503});
  }finally{client.release();}
}
