import { NextResponse } from "next/server";
import { requirePremiumApiCapability, StudioAccessError } from "@/lib/studio/capabilities";
import { getCampaignDailySummary, previousKarachiDay } from "@/lib/studio/campaign-daily";

export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request) {
  try{
    await requirePremiumApiCapability("premium:reports:read");
    const date=new URL(request.url).searchParams.get("date") || previousKarachiDay();
    const report=await getCampaignDailySummary(date);
    return NextResponse.json(report,{headers:{"cache-control":"private, no-store"}});
  }catch(error){
    const status=error instanceof StudioAccessError?error.status:
      error instanceof Error&&/date|range/i.test(error.message)?400:503;
    return NextResponse.json({error:error instanceof StudioAccessError?error.message:
      status===400?"Invalid report date.":"Daily log unavailable."},
      {status,headers:{"cache-control":"private, no-store"}});
  }
}
