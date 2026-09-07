import { NextResponse } from "next/server";
import { requirePaymentUserId, paymentErrorResponse, validRemoteId } from "@/lib/payments/bff";
import { cancelPaymentServiceSubscription } from "@/lib/payments/payment-service";

export const runtime = "nodejs";
type Params = Promise<{ id: string }>;

export async function POST(_request: Request, { params }: { params: Params }) {
  const userId = await requirePaymentUserId();
  if (!userId) return NextResponse.json({ error: "unauthorized", message: "Sign in required." }, { status: 401 });
  const { id } = await params;
  if (!validRemoteId(id)) return NextResponse.json({ error: "invalid_body", message: "Invalid subscription." }, { status: 400 });
  try {
    return NextResponse.json(await cancelPaymentServiceSubscription(id), { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    return paymentErrorResponse(error);
  }
}
