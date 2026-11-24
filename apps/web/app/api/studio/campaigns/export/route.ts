import { NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { requirePremiumApiCapability, StudioAccessError } from "@/lib/studio/capabilities";
import { createAdminClient } from "@/lib/database/admin";
import { getCampaignPaidReport, readCampaignFilters } from "@/lib/studio/campaign-reports";
import { generateCampaignXlsx } from "@/lib/reports/campaign-xlsx.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const {user}=await requirePremiumApiCapability("premium:reports:export");
    const filters=readCampaignFilters(new URL(request.url).searchParams);
    const report=await getCampaignPaidReport(filters);
    const buffer=generateCampaignXlsx(report);
    const sha256=createHash("sha256").update(buffer).digest("hex");
    const {error}=await createAdminClient().from("audit_logs").insert({
      actor_id:user.id,action:"campaign_report_exported",entity_type:"campaign_report",
      entity_id:"basic-detailed-datewise",metadata:{
        filters,timezone:"Asia/Karachi",schema_version:"campaign-v1",
        row_count:report.dateWise.length,subs:report.totals.subs,content_sha256:sha256,
      },
    });
    if(error) throw new Error("Export audit failed.");
    return new NextResponse(new Uint8Array(buffer),{
      status:200,
      headers:{
        "content-type":"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "content-disposition":`attachment; filename="jalwa-campaign-${filters.start}-to-${filters.end}.xlsx"`,
        "cache-control":"private, no-store",
        "x-content-type-options":"nosniff",
        "x-campaign-report-sha256":sha256,
      },
    });
  } catch(error) {
    const status=error instanceof StudioAccessError?error.status:
      error instanceof Error && /date|range|limit/i.test(error.message)?400:503;
    return NextResponse.json({error:error instanceof StudioAccessError?error.message:
      status===400?"Invalid report filters.":"Campaign export is unavailable."},
      {status,headers:{"cache-control":"private, no-store"}});
  }
}
