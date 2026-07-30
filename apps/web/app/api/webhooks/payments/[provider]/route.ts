import { NextResponse } from "next/server";
import { processPaymentEvent } from "@/lib/payments/webhook";

export const runtime = "nodejs";
type Params = Promise<{ provider: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  const { provider } = await params;
  if (!["payfast", "jazzcash", "easypaisa"].includes(provider)) return NextResponse.json({ error: "Unknown provider." }, { status: 404 });
  const rawBody = await request.text();
  let payload: { eventId?: string; orderId?: string; transactionId?: string; amountMinor?: number; currency?: string; status?: string };
  try { payload = JSON.parse(rawBody); }
  catch { return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 }); }
  if (!payload.eventId || !payload.orderId || !payload.transactionId || !Number.isInteger(payload.amountMinor) || !payload.currency) return NextResponse.json({ error: "Invalid payment event." }, { status: 400 });
  if (payload.status !== "succeeded") return NextResponse.json({ received: true });
  const result = await processPaymentEvent(rawBody, request.headers.get("x-jalwa-signature"), { eventId: payload.eventId, orderId: payload.orderId, transactionId: payload.transactionId, amountMinor: payload.amountMinor!, currency: payload.currency, provider: provider as "payfast" | "jazzcash" | "easypaisa" });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, subscriptionId: result.subscriptionId });
}
