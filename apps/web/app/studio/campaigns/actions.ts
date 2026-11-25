"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireStaff } from "@/lib/studio/auth";
import { createAdminClient } from "@/lib/database/admin";

function field(form: FormData, key: string, max = 120) {
  const value = form.get(key);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}
async function adminActor() {
  const { user, profile } = await requireStaff();
  if (profile.role !== "admin") throw new Error("Admin capability required.");
  if (process.env.JALWA_CAMPAIGN_ANALYTICS_ENABLED !== "true") throw new Error("Campaign management disabled.");
  return user.id;
}
async function audit(actor: string, id: string, action: string, data: Record<string,unknown>) {
  const {error} = await createAdminClient().from("audit_logs").insert({
    actor_id:actor,action,entity_type:"campaign_config",entity_id:id,metadata:data,
  });
  if (error) throw error;
}
export async function createCampaign(form: FormData) {
  const actor = await adminActor();
  const name = field(form,"name",160);
  const landingPath = field(form,"landing_path",180);
  const source = field(form,"source",80);
  const planCode = field(form,"plan_code",80);
  if (name.length < 2 || !/^\/[a-zA-Z0-9/_-]{1,170}$/.test(landingPath)
      || !source || !planCode) throw new Error("Campaign name, landing path, platform and active plan are required.");
  const db = createAdminClient();
  const {data:price,error:priceError} = await db.from("prices").select("code").eq("code",planCode).eq("is_active",true).maybeSingle();
  if (priceError || !price) throw new Error("Selected price code is not an active server-side plan.");
  const {data,error} = await db.from("campaign_configs").insert({
    name,landing_path:landingPath,source,plan_code:planCode,
    product:field(form,"product",80)||"jalwa",
    utm_campaign:field(form,"utm_campaign",120),
    utm_medium:field(form,"utm_medium",80),
    parameter:field(form,"parameter",80),
    referral:field(form,"referral",80),
    creative_id:field(form,"creative_id",100),
    is_active:false,created_by:actor,updated_by:actor,
  }).select("id").single();
  if(error || !data) throw new Error("Campaign could not be created.");
  await audit(actor,data.id,"campaign_created",{name,planCode,landingPath,active:false});
  revalidatePath("/studio/campaigns/manage");
  redirect("/studio/campaigns/manage?created=1");
}
export async function changeCampaignState(form: FormData) {
  const actor=await adminActor();
  const id=field(form,"campaign_id",36);
  const enabled=field(form,"enabled",5)==="true";
  if(!/^[0-9a-f-]{36}$/i.test(id)) throw new Error("Invalid campaign id.");
  const db=createAdminClient();
  const {data,error}=await db.from("campaign_configs")
    .update({is_active:enabled,updated_by:actor,updated_at:new Date().toISOString()})
    .eq("id",id).select("id,name,is_active").single();
  if(error || !data) throw new Error("Campaign state could not be changed.");
  await audit(actor,id,"campaign_state_changed",{enabled,name:data.name});
  revalidatePath("/studio/campaigns/manage");
  redirect("/studio/campaigns/manage");
}
