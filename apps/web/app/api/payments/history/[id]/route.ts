import { NextResponse } from "next/server";
import { requirePaymentUserId, paymentErrorResponse, validRemoteId } from "@/lib/payments/bff";
import { getPaymentServicePayment, getPaymentServicePayments } from "@/lib/payments/payment-service";

export const runtime = "nodejs";
type Params = Promise<{ id: string }>;

export async function GET(_request: Request, { params }: { params: Params }) {
  const userId = await requirePaymentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 });
  const { id } = await params;
  if (!validRemoteId(id)) return NextResponse.json({ error: "invalid_body", message: "Invalid payment." }, { status: 400 });
  try {
    const payments = await getPaymentServicePayments(userId);
    if (!payments.some((payment) => payment.id === id)) {
      return NextResponse.json({ error: "not_found", message: "Payment was not found." }, { status: 404 });
    }
    return NextResponse.json(await getPaymentServicePayment(id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return paymentErrorResponse(error);
  }
}
