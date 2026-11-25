import { databasePool } from "@/lib/database/pool";

type QueueItem = {
  provider:string;remote_payment_id:string;ga_client_id:string;
  amount_minor:number;currency:string;plan_code:string;source:string;
  utm_campaign:string;
};
export async function dispatchVerifiedCampaignGa4() {
  if(process.env.DEPLOYMENT_ENVIRONMENT!=="staging"
    || process.env.JALWA_CAMPAIGN_ANALYTICS_ENABLED!=="true"
    || process.env.JALWA_CAMPAIGN_GA4_ENABLED!=="true")
    return {sent:0,disabled:true};
  const measurementId=process.env.JALWA_GA4_MEASUREMENT_ID;
  const apiSecret=process.env.JALWA_GA4_API_SECRET;
  if(!measurementId || !/^G-[A-Z0-9]+$/i.test(measurementId) || !apiSecret)
    throw new Error("GA4 Measurement Protocol credentials are not configured.");
  let sent=0;
  const failed=[];
  for(let i=0;i<25;i++){
    const c=await databasePool.connect();
    let row:QueueItem|undefined;
    try{
      await c.query("begin");
      const q=await c.query<QueueItem>(`
        select q.provider::text provider,q.remote_payment_id,a.ga_client_id,p.amount_minor,p.currency,
          a.plan_code,a.source,a.utm_campaign
        from public.campaign_ga4_outbox q
        join public.campaign_payment_links l on l.provider=q.provider and l.remote_payment_id=q.remote_payment_id
        join public.payment_service_payments p on p.provider=q.provider and p.remote_payment_id=q.remote_payment_id
        join public.campaign_attributions a on a.id=q.attribution_id
        where (q.status in ('pending','failed') or
              (q.status='sending' and q.updated_at < now()-interval '30 minutes'))
          and q.attempts<5 and p.status='completed'
          and a.consent_state='granted' and a.ga_client_id is not null
        order by q.updated_at asc
        for update of q skip locked limit 1
      `);
      row=q.rows[0];
      if(!row){await c.query("rollback");break;}
      await c.query(`
        update public.campaign_ga4_outbox set status='sending',attempts=attempts+1,
          updated_at=now() where provider=$1::public.payment_provider and remote_payment_id=$2`,
        [row.provider,row.remote_payment_id]);
      await c.query("commit");
    }catch(error){
      await c.query("rollback").catch(()=>{});
      throw error;
    }finally{c.release();}
    try{
      const amount=Number(row.amount_minor)/100;
      const transactionId=row.provider+":"+row.remote_payment_id;
      const payload={
        client_id:row.ga_client_id,
        events:[{name:"purchase",params:{
          transaction_id:transactionId,value:amount,currency:row.currency,
          items:[{item_id:row.plan_code||"premium",item_name:"Jalwa Premium",quantity:1,price:amount}],
          source:row.source,campaign:row.utm_campaign,
        }}],
      };
      const res=await fetch(
        "https://www.google-analytics.com/mp/collect?measurement_id="+encodeURIComponent(measurementId)+
        "&api_secret="+encodeURIComponent(apiSecret),
        {method:"POST",headers:{"content-type":"application/json"},
          body:JSON.stringify(payload),signal:AbortSignal.timeout(10000),cache:"no-store"},
      );
      if(!res.ok)throw new Error("GA4 rejected HTTP status "+res.status);
      await databasePool.query(`
        update public.campaign_ga4_outbox set status='sent',sent_at=now(),updated_at=now(),last_error=null
        where provider=$1::public.payment_provider and remote_payment_id=$2 and status='sending'`,
        [row.provider,row.remote_payment_id]);
      sent++;
    }catch{
      failed.push(true);
      await databasePool.query(`
        update public.campaign_ga4_outbox set status='failed',last_error=$3,updated_at=now()
        where provider=$1::public.payment_provider and remote_payment_id=$2 and status='sending'`,
        [row.provider,row.remote_payment_id,
         "ga4_dispatch_failure"]).catch(()=>{});
    }
  }
  return {sent,failedCount:failed.length};
}
