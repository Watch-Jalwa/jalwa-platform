import { NextResponse } from "next/server";
import { requirePremiumApiCapability, StudioAccessError } from "@/lib/studio/capabilities";
import { getCampaignPaidReport, readCampaignFilters } from "@/lib/studio/campaign-reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    // Existing finance/admin capability; deny roles without explicit financial reporting grants.
    await requirePremiumApiCapability("premium:reports:read");
    const filters = readCampaignFilters(new URL(request.url).searchParams);
    const report = await getCampaignPaidReport(filters);
    return NextResponse.json(report, {headers:{"cache-control":"private, no-store"}});
  } catch (error) {
    const status = error instanceof StudioAccessError ? error.status
      : error instanceof Error && /date|range|limit/i.test(error.message) ? 400
      : error instanceof Error && /disabled/.test(error.message) ? 503 : 500;
    return NextResponse.json({error: error instanceof StudioAccessError ? error.message
      : status === 400 ? "Invalid campaign report filters." : "Campaign report is unavailable."},
      {status,headers:{"cache-control":"private, no-store"}});
  }
}
