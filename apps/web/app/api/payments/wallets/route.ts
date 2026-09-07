import { NextResponse } from "next/server";
import { requirePaymentUserId, paymentErrorResponse } from "@/lib/payments/bff";
import { getPaymentServiceWallet } from "@/lib/payments/payment-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const userId = await requirePaymentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 });
  try {
    return NextResponse.json(await getPaymentServiceWallet(userId), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return paymentErrorResponse(error);
  }
}
