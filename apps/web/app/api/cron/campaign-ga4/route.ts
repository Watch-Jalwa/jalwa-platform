import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { dispatchVerifiedCampaignGa4 } from "@/lib/studio/campaign-ga4";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function POST(request:Request) {
  if(process.env.DEPLOYMENT_ENVIRONMENT!=="staging")
    return NextResponse.json({error:"Staging-only"},{status:403});
  const expected=process.env.JALWA_CAMPAIGN_CRON_SECRET;
  const header=request.headers.get("authorization");
  const supplied=header?.startsWith("Bearer ")?header.slice(7):"";
  if(!expected || expected.length<24 || Buffer.byteLength(supplied)!==Buffer.byteLength(expected)
      || !timingSafeEqual(Buffer.from(supplied),Buffer.from(expected)))
    return NextResponse.json({error:"Unauthorized"},{status:401});
  try{return NextResponse.json(await dispatchVerifiedCampaignGa4(),{headers:{"cache-control":"no-store"}});}
  catch{return NextResponse.json({error:"GA4 outbox unavailable"},{status:503});}
}
