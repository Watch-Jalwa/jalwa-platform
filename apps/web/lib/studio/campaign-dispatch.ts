import nodemailer from "nodemailer";
import { databasePool } from "@/lib/database/pool";
import { getCampaignDailySummary } from "@/lib/studio/campaign-daily";
import { dispatchDecision, allRecipientsAccepted, priorKarachiDate } from "@/lib/reports/campaign-delivery.mjs";
import { getCampaignPaidReport, campaignFeatureEnabled } from "@/lib/studio/campaign-reports";
import { generateCampaignXlsx } from "@/lib/reports/campaign-xlsx.mjs";
import { composeCampaignDailyDigest } from "@/lib/reports/campaign-digest.mjs";

type Settings = {
  enabled:boolean;timezone:string;delivery_hour:number;delivery_minute:number;recipient_emails:string[];
};
type Dispatch = {status:string;attempts:number};
function validRecipient(email:string) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email) && email.length<=254;
}
export async function dispatchCampaignDaily(now=new Date()) {
  if(!campaignFeatureEnabled() || process.env.JALWA_CAMPAIGN_EMAIL_ENABLED!=="true")
    return {sent:false,reason:"disabled"};
  const day=priorKarachiDate(now);
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
    recipients=[...new Set((settings.recipient_emails??[]).map(x=>x.trim().toLowerCase()))];
    if(!recipients.length || recipients.length>10 || !recipients.every(validRecipient) || settings.timezone!=="Asia/Karachi")
      throw new Error("Invalid configured campaign-report recipients/timezone.");
    const prior=await client.query<Dispatch>(
      "select status,attempts from public.campaign_daily_dispatches where report_date=$1 and timezone='Asia/Karachi' for update",
      [day],
    );
    const decision=dispatchDecision(now,settings,prior.rows[0]);
    if(decision!=="ready"){await client.query("rollback");return {sent:false,reason:decision};}
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

  // Once SMTP submission starts, delivery may have occurred even if the response is lost.
  // Never automatically resend a partially accepted or ambiguous report.
  let submissionStarted=false;
  try{
    const [daily,paid]=await Promise.all([
      getCampaignDailySummary(day),
      getCampaignPaidReport({start:day,end:day}),
    ]);
    const attachment=generateCampaignXlsx(paid);
    const digest=composeCampaignDailyDigest(daily,paid,day);
    if(!process.env.SMTP_HOST) throw new Error("SMTP is not configured.");
    const mail=nodemailer.createTransport({
      host:process.env.SMTP_HOST,
      port:Number(process.env.SMTP_PORT??587),
      secure:process.env.SMTP_SECURE==="true",
      requireTLS:process.env.SMTP_SECURE!=="true",
      connectionTimeout:10_000,
      greetingTimeout:10_000,
      socketTimeout:25_000,
      auth:process.env.SMTP_USER?{
        user:process.env.SMTP_USER,pass:process.env.SMTP_PASS??process.env.SMTP_PASSWORD??"",
      }:undefined,
    });
    // Verify connection/authentication before entering the ambiguous submission phase.
    await mail.verify();
    submissionStarted=true;
    const result=await mail.sendMail({
      from:process.env.SMTP_FROM??"Jalwa <no-reply@watch-jalwa.com>",
      to:recipients.join(","),
      subject:digest.subject,
      text:digest.text,
      messageId:"<campaign-"+day+"@watch-jalwa.com>",
      attachments:[{filename:digest.filename,
        content:attachment,contentType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"}],
    });
    if(!allRecipientsAccepted(recipients,result.accepted,result.rejected))
      throw new Error("SMTP acceptance incomplete; manual reconciliation required.");
    await databasePool.query(`
      update public.campaign_daily_dispatches set status='sent',sent_at=now(),updated_at=now(),
        last_error=null where report_date=$1 and timezone='Asia/Karachi' and status='pending'`,[day]);
    return {sent:true,date:day,recipientCount:recipients.length};
  }catch(error){
    await databasePool.query(`
      update public.campaign_daily_dispatches set status=$2,last_error=$3,updated_at=now()
      where report_date=$1 and timezone='Asia/Karachi' and status='pending'`,
      [day,submissionStarted?"pending":"failed",submissionStarted?"smtp_acceptance_uncertain_reconcile_before_resend":"pre_submission_failure"]).catch(()=>{});
    throw error;
  }
}
