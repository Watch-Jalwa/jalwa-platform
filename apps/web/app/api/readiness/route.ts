import { NextResponse } from "next/server";
import { getReadinessDetails } from "@/lib/readiness";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const details = await getReadinessDetails();
  return NextResponse.json({
    service: details.service,
    status: details.status,
    version: details.version,
    time: details.time,
  }, {
    status: details.ready ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
