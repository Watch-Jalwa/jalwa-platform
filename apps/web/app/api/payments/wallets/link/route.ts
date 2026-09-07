import { NextResponse } from "next/server";
import { requirePaymentUserId, paymentErrorResponse, validMsisdn, validPlanCode } from "@/lib/payments/bff";
import { linkPaymentServiceWallet } from "@/lib/payments/payment-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userId = await requirePaymentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { msisdn?: unknown; planCode?: unknown };
  if (!validMsisdn(body.msisdn)) {
    return NextResponse.json({ error: "invalid_body", message: "Enter a valid 11–15 digit JazzCash mobile number." }, { status: 400 });
  }
  if (body.planCode !== undefined && !validPlanCode(body.planCode)) {
    return NextResponse.json({ error: "invalid_body", message: "Select a valid plan." }, { status: 400 });
  }
  try {
    const result = await linkPaymentServiceWallet({ userId, msisdn: body.msisdn, planCode: body.planCode as string | undefined });
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return paymentErrorResponse(error);
  }
}
