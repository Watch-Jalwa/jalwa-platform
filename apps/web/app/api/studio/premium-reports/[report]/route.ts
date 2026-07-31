import { NextResponse } from "next/server";
import { requirePremiumApiCapability, StudioAccessError } from "@/lib/studio/capabilities";
import { getBenefitCostReport, getPaymentLedger, getPremiumSummary, getReconciliationReport, getRecurringCustomers, getSubscriptionLedger } from "@/lib/studio/premium-reports";

export const runtime = "nodejs";
type Params = Promise<{ report: string }>;

export async function GET(request: Request, { params }: { params: Params }) {
  try {
    await requirePremiumApiCapability("premium:reports:read");
    const { report } = await params;
    const search = new URL(request.url).searchParams;
    const payload = report === "summary" ? await getPremiumSummary(search)
      : report === "payments" ? await getPaymentLedger(search)
      : report === "subscriptions" ? await getSubscriptionLedger(search)
      : report === "recurring" ? await getRecurringCustomers(search)
      : report === "reconciliation" ? await getReconciliationReport(search)
      : report === "benefits" ? await getBenefitCostReport(search)
      : null;
    if (!payload) return NextResponse.json({ error: "Unknown Premium report." }, { status: 404 });
    return NextResponse.json(payload, { headers: { "cache-control": "private, no-store" } });
  } catch (error) {
    const status = error instanceof StudioAccessError ? error.status : error instanceof Error && /range|date|limit/i.test(error.message) ? 400 : 500;
    const message = error instanceof StudioAccessError ? error.message : status === 400 && error instanceof Error ? error.message : "Premium report could not be generated.";
    return NextResponse.json({ error: message }, { status, headers: { "cache-control": "private, no-store" } });
  }
}
