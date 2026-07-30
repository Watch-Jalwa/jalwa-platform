import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { processPaymentEvent, type PaymentEvent } from "@/lib/payments/webhook";
import { signPaymentPayload } from "@/lib/payments/signature.mjs";

export const runtime = "nodejs";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_PAYMENTS !== "true") {
    return NextResponse.json({ error: "Mock payments are disabled." }, { status: 403 });
  }

  const form = await request.formData();
  const orderId = String(form.get("orderId") ?? "");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL("/login?next=/pricing", request.url), 303);

  const { data: order } = await supabase.from("checkout_orders")
    .select("id,user_id,amount_minor,currency,status")
    .eq("id", orderId).eq("user_id", user.id).maybeSingle();

  if (!order) return NextResponse.json({ error: "Order not found." }, { status: 404 });

  const event: PaymentEvent = {
    eventId: `evt_${crypto.randomUUID()}`,
    orderId: order.id,
    transactionId: `txn_${crypto.randomUUID()}`,
    amountMinor: order.amount_minor,
    currency: order.currency,
    provider: "mock",
  };
  const rawBody = JSON.stringify(event);
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret) return NextResponse.json({ error: "Payment webhook secret is not configured." }, { status: 503 });

  const result = await processPaymentEvent(rawBody, signPaymentPayload(rawBody, secret), event);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.redirect(new URL(`/billing/success?order=${encodeURIComponent(order.id)}`, request.url), 303);
}
