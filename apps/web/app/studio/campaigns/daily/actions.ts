"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/studio/auth";
import { createAdminClient } from "@/lib/database/admin";

export async function saveCampaignDigestSettings(form:FormData) {
  const {user,profile}=await requireStaff();
  if(profile.role!=="admin") throw new Error("Admin required.");
  if(process.env.JALWA_CAMPAIGN_ANALYTICS_ENABLED!=="true") throw new Error("Campaign analytics disabled.");
  const raw=String(form.get("recipients")??"");
  const recipients=[...new Set(raw.split(/[\n,;]/).map(x=>x.trim().toLowerCase()).filter(Boolean))];
  if(recipients.length>10 || recipients.some(x=>x.length>254 || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(x)))
    throw new Error("Invalid recipient list.");
  const hour=Number(form.get("hour"));
  const minute=Number(form.get("minute"));
  if(!Number.isInteger(hour)||hour<0||hour>23||!Number.isInteger(minute)||minute<0||minute>59)
    throw new Error("Invalid report delivery time.");
  const requested=form.get("enabled")==="on";
  // Deliberate second gate: admin UI cannot activate outbound email without staging operator flag.
  const enabled=requested && process.env.JALWA_CAMPAIGN_EMAIL_ENABLED==="true" && recipients.length>0;
  const db=createAdminClient();
  const {error}=await db.from("campaign_report_settings").upsert({
    id:true,timezone:"Asia/Karachi",delivery_hour:hour,delivery_minute:minute,
    recipient_emails:recipients,enabled,updated_by:user.id,updated_at:new Date().toISOString(),
  },{onConflict:"id"});
  if(error)throw new Error("Could not save report schedule.");
  const {error:auditError}=await db.from("audit_logs").insert({
    actor_id:user.id,action:"campaign_digest_settings_changed",entity_type:"campaign_settings",
    entity_id:"daily",metadata:{recipient_count:recipients.length,hour,minute,enabled},
  });
  if(auditError)throw new Error("Schedule audit could not be recorded.");
  revalidatePath("/studio/campaigns/daily");
  redirect("/studio/campaigns/daily?saved=1");
}
