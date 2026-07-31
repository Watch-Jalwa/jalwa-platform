import { NextResponse } from "next/server";
import { processPaymentEvent, type PaymentEventStatus } from "@/lib/payments/webhook";

export const runtime = "nodejs";
type Params = Promise<{ provider: string }>;
const providers = new Set(["payfast", "jazzcash", "easypaisa"]);
const statuses = new Set<PaymentEventStatus>(["succeeded", "failed", "refunded", "partially_refunded", "disputed"]);

export async function POST(request: Request, { params }: { params: Params }) {
  const { provider } = await params;
  if (!providers.has(provider)) return NextResponse.json({ error: "Unknown provider." }, { status: 404 });
  const rawBody = await request.text();
  let payload: { eventId?: unknown; orderId?: unknown; transactionId?: unknown; amountMinor?: unknown; currency?: unknown; status?: unknown; reason?: unknown };
  try { payload = JSON.parse(rawBody); }
  catch { return NextResponse.json({ error: "Invalid JSON payload." }, { status: 400 }); }

  const eventStatus = typeof payload.status === "string" && statuses.has(payload.status as PaymentEventStatus) ? payload.status as PaymentEventStatus : null;
  if (
    typeof payload.eventId !== "string" || payload.eventId.length < 1 || payload.eventId.length > 200 ||
    typeof payload.orderId !== "string" || typeof payload.transactionId !== "string" || payload.transactionId.length < 1 || payload.transactionId.length > 200 ||
    !Number.isInteger(payload.amountMinor) || Number(payload.amountMinor) < 0 ||
    typeof payload.currency !== "string" || !/^[A-Z]{3}$/.test(payload.currency) || !eventStatus
  ) return NextResponse.json({ error: "Invalid payment event." }, { status: 400 });

  const result = await processPaymentEvent(rawBody, request.headers.get("x-jalwa-signature"), {
    eventId: payload.eventId,
    orderId: payload.orderId,
    transactionId: payload.transactionId,
    amountMinor: Number(payload.amountMinor),
    currency: payload.currency,
    status: eventStatus,
    reason: typeof payload.reason === "string" ? payload.reason.slice(0, 1000) : null,
    provider: provider as "payfast" | "jazzcash" | "easypaisa",
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });
  return NextResponse.json({ ok: true, ...result.result });
}
