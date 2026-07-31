import { NextResponse } from "next/server";
import { requirePremiumApiCapability, StudioAccessError } from "@/lib/studio/capabilities";
import { auditPremiumExport, generatePremiumCsv } from "@/lib/studio/premium-reports";

export const runtime = "nodejs";
type Params = Promise<{ report: string }>;

export async function GET(request: Request, { params }: { params: Params }) {
  try {
    const { user } = await requirePremiumApiCapability("premium:reports:export");
    const { report } = await params;
    const result = await generatePremiumCsv(report, new URL(request.url).searchParams);
    await auditPremiumExport(user.id, report, result);
    return new NextResponse(result.csv, {
      status: 200,
      headers: {
        "content-type": "text/csv; charset=utf-8",
        "content-disposition": `attachment; filename="${result.filename}"`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "x-jalwa-report-schema": result.payload.schemaVersion,
        "x-jalwa-report-sha256": result.hash,
      },
    });
  } catch (error) {
    const status = error instanceof StudioAccessError ? error.status : error instanceof Error && /limit|range|unsupported|approved|ledger/i.test(error.message) ? 400 : 500;
    const message = error instanceof StudioAccessError ? error.message : status === 400 && error instanceof Error ? error.message : "Premium export could not be generated.";
    return NextResponse.json({ error: message }, { status, headers: { "cache-control": "private, no-store" } });
  }
}
