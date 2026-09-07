import { NextResponse } from "next/server";
import { requirePaymentUserId, paymentErrorResponse, validPlanCode } from "@/lib/payments/bff";
import { createPaymentServiceSubscription } from "@/lib/payments/payment-service";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const userId = await requirePaymentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { planCode?: unknown; skipTrial?: unknown };
  if (!validPlanCode(body.planCode) || (body.skipTrial !== undefined && typeof body.skipTrial !== "boolean")) {
    return NextResponse.json({ error: "invalid_body", message: "Select a valid subscription plan." }, { status: 400 });
  }
  try {
    const result = await createPaymentServiceSubscription({ userId, planCode: body.planCode, skipTrial: body.skipTrial as boolean | undefined });
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return paymentErrorResponse(error);
  }
}
