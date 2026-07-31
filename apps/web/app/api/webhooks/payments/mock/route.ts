import { NextResponse } from "next/server";
import { processPaymentEvent, type PaymentEvent } from "@/lib/payments/webhook";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_PAYMENTS !== "true") {
    return NextResponse.json({ error: "Mock payments are disabled." }, { status: 403 });
  }
  const rawBody = await request.text();
  let event: PaymentEvent;
  try {
    event = JSON.parse(rawBody) as PaymentEvent;
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }
  if (event.provider !== "mock" || !event.status) return NextResponse.json({ error: "Invalid mock payment event." }, { status: 400 });

  const result = await processPaymentEvent(rawBody, request.headers.get("x-jalwa-signature"), event);
  return NextResponse.json(result.ok ? { received: true, ...result.result } : { error: result.error }, { status: result.ok ? 200 : result.status });
}
