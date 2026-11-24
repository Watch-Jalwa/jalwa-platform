import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { dispatchCampaignDaily } from "@/lib/studio/campaign-dispatch";

export const runtime="nodejs";
export const dynamic="force-dynamic";
function authorized(value:string|null,secret:string|undefined) {
  if(!secret || secret.length<24 || !value?.startsWith("Bearer "))return false;
  const supplied=Buffer.from(value.slice(7));
  const expected=Buffer.from(secret);
  return supplied.length===expected.length && timingSafeEqual(supplied,expected);
}
export async function POST(request:Request) {
  if(process.env.DEPLOYMENT_ENVIRONMENT!=="staging")
    return NextResponse.json({error:"Staging-only scheduler"},{status:403});
  if(!authorized(request.headers.get("authorization"),process.env.JALWA_CAMPAIGN_CRON_SECRET))
    return NextResponse.json({error:"Unauthorized"},{status:401});
  try{
    const result=await dispatchCampaignDaily();
    return NextResponse.json(result,{headers:{"cache-control":"no-store"}});
  }catch{
    return NextResponse.json({error:"Daily report dispatch failed"},{status:503,headers:{"cache-control":"no-store"}});
  }
}
