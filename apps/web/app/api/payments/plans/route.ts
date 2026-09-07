import { NextResponse } from "next/server";
import { getPaymentServicePlans } from "@/lib/payments/payment-service";
import { paymentErrorResponse } from "@/lib/payments/bff";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    return NextResponse.json(await getPaymentServicePlans(), { headers: { "Cache-Control": "private, no-store" } });
  } catch (error) {
    return paymentErrorResponse(error);
  }
}
