import nodemailer from "nodemailer";
import { databasePool } from "@/lib/database/pool";
import { getCampaignDailySummary, previousKarachiDay } from "@/lib/studio/campaign-daily";
import { getCampaignPaidReport, campaignFeatureEnabled } from "@/lib/studio/campaign-reports";
import { generateCampaignXlsx } from "@/lib/reports/campaign-xlsx.mjs";

type Settings = {
  enabled:boolean;timezone:string;delivery_hour:number;delivery_minute:number;recipient_emails:string[];
};
type Dispatch = {status:string;updated_at:Date;attempts:number};
function validRecipient(email:string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && email.length<=254;
}
function localClock(now:Date) {
  const parts=new Intl.DateTimeFormat("en-GB",{
    timeZone:"Asia/Karachi",hour:"2-digit",minute:"2-digit",hourCycle:"h23",
  }).formatToParts(now);
  const part=(type:string)=>Number(parts.find(x=>x.type===type)?.value??0);
  return {hour:part("hour"),minute:part("minute")};
}
export async function dispatchCampaignDaily(now=new Date()) {
  if(!campaignFeatureEnabled() || process.env.JALWA_CAMPAIGN_EMAIL_ENABLED!=="true")
    return {sent:false,reason:"disabled"};
  const day=previousKarachiDay(now);
  const client=await databasePool.connect();
  let recipients:string[]=[];
  try{
    await client.query("begin");
    const lock=await client.query<{locked:boolean}>(
      "select pg_try_advisory_xact_lock(hashtext($1)) locked",["jalwa-campaign-daily:"+day],
    );
    if(!lock.rows[0]?.locked) {await client.query("rollback");return {sent:false,reason:"in_progress"};}
    const settingResult=await client.query<Settings>(
      "select enabled,timezone,delivery_hour,delivery_minute,recipient_emails from public.campaign_report_settings where id=true for update",
    );
    const settings=settingResult.rows[0];
    if(!settings?.enabled){await client.query("rollback");return {sent:false,reason:"settings_disabled"};}
    recipients=(settings.recipient_emails??[]).map(x=>x.trim().toLowerCase());
    if(!recipients.length || recipients.length>10 || !recipients.every(validRecipient) || settings.timezone!=="Asia/Karachi")
      throw new Error("Invalid configured campaign-report recipients/timezone.");
    const clock=localClock(now);
    if(clock.hour*60+clock.minute < settings.delivery_hour*60+settings.delivery_minute){
      await client.query("rollback");return {sent:false,reason:"scheduled_later"};
    }
    const prior=await client.query<Dispatch>(
      "select status,updated_at,attempts from public.campaign_daily_dispatches where report_date=$1 and timezone='Asia/Karachi' for update",
      [day],
    );
    if(prior.rows[0]?.status==="sent") {
      await client.query("rollback");return {sent:false,reason:"already_sent"};
    }
    if(prior.rows[0]?.status==="pending"
      && now.getTime()-new Date(prior.rows[0].updated_at).getTime()<30*60_000){
      await client.query("rollback");return {sent:false,reason:"in_progress"};
    }
    if((prior.rows[0]?.attempts??0)>=3){
      await client.query("rollback");return {sent:false,reason:"retry_limit"};
    }
    await client.query(`
      insert into public.campaign_daily_dispatches(report_date,timezone,status,idempotency_key,
        recipients,attempts,updated_at)
      values($1,'Asia/Karachi','pending',$2,$3::text[],1,now())
      on conflict(report_date,timezone) do update set
        status='pending',recipients=excluded.recipients,attempts=public.campaign_daily_dispatches.attempts+1,
        updated_at=now(),last_error=null`,
      [day,"jalwa-campaign-digest-"+day,recipients],
    );
    await client.query("commit");
  }catch(error){
    await client.query("rollback").catch(()=>{});
    throw error;
  }finally{client.release();}

  try{
    const [daily,paid]=await Promise.all([
      getCampaignDailySummary(day),
      getCampaignPaidReport({start:day,end:day}),
    ]);
    const attachment=generateCampaignXlsx(paid);
    const lines=[
      "Jalwa — Campaign & JazzCash Daily Logs",day,"Timezone: Asia/Karachi",
      "Landing views: "+daily.landingViews,
      "Unique attributed visitors: "+daily.uniqueLandingVisitors,
      "HE traffic: Unknown (classification not supplied)",
      "NON HE traffic: Unknown (classification not supplied)",
      "Paywall visits: "+daily.paywallVisits,
      "Unique paywall visits: "+daily.uniquePaywallVisits,
      "MPIN reached: "+(daily.mpinCount??"Not observable from JazzCash"),
      "Verified payment success count: "+daily.successCount,
      "Payment failure count: "+daily.failureCount,
      "Campaign-attributed paid Subs: "+paid.totals.subs,
      "Failure reasons:",
      ...daily.failureReasons.map(x=>" - "+x.code+" / "+x.reason+": "+x.count),
      "Reporting timestamp: "+daily.generatedAt,
    ];
    if(!process.env.SMTP_HOST) throw new Error("SMTP is not configured.");
    const mail=nodemailer.createTransport({
      host:process.env.SMTP_HOST,
      port:Number(process.env.SMTP_PORT??587),
      secure:process.env.SMTP_SECURE==="true",
      auth:process.env.SMTP_USER?{
        user:process.env.SMTP_USER,pass:process.env.SMTP_PASSWORD??"",
      }:undefined,
    });
    const result=await mail.sendMail({
      from:process.env.SMTP_FROM??"Jalwa <no-reply@watch-jalwa.com>",
      to:recipients.join(","),
      subject:"Campaign & JazzCash Daily Logs | "+day,
      text:lines.join("\n"),
      messageId:"<campaign-"+day+"@watch-jalwa.com>",
      attachments:[{filename:"jalwa-campaign-"+day+".xlsx",
        content:attachment,contentType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}],
    });
    if(!result.accepted?.length) throw new Error("No configured recipient accepted the daily report.");
    await databasePool.query(`
      update public.campaign_daily_dispatches set status='sent',sent_at=now(),updated_at=now(),
        last_error=null where report_date=$1 and timezone='Asia/Karachi' and status='pending'`,[day]);
    return {sent:true,date:day,recipientCount:recipients.length};
  }catch(error){
    await databasePool.query(`
      update public.campaign_daily_dispatches set status='failed',last_error=$2,updated_at=now()
      where report_date=$1 and timezone='Asia/Karachi' and status='pending'`,
      [day,(error instanceof Error?error.message:"unknown").slice(0,200)]).catch(()=>{});
    throw error;
  }
}
