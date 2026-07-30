import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createHostedCheckout } from "@/lib/payments/provider";
import { createAdminClient } from "@/lib/supabase/admin";

export const runtime = "nodejs";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as { priceId?: string; idempotencyKey?: string };
  if (!body.priceId) return NextResponse.json({ error: "Price is required." }, { status: 400 });
  const idempotencyKey = body.idempotencyKey?.trim() || crypto.randomUUID();
  const provider = (process.env.PAYMENT_PROVIDER ?? "mock") as "mock" | "payfast" | "jazzcash" | "easypaisa";
  const { data: orderId, error } = await supabase.rpc("create_checkout_order", { p_price_id: body.priceId, p_provider: provider, p_idempotency_key: idempotencyKey });
  if (error || !orderId) return NextResponse.json({ error: error?.message ?? "Checkout could not be created." }, { status: 400 });
  const { data: order } = await supabase.from("checkout_orders").select("amount_minor,currency").eq("id", orderId).single();
  if (!order) return NextResponse.json({ error: "Checkout order unavailable." }, { status: 500 });
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  try {
    const session = await createHostedCheckout({ orderId, amountMinor: order.amount_minor, currency: order.currency, returnUrl: `${baseUrl}/billing/success`, webhookUrl: `${baseUrl}/api/webhooks/payments/${provider}`, customerEmail: user.email });
    const admin = createAdminClient();
    await admin.from("checkout_orders").update({ status: "pending", provider_order_reference: session.providerOrderReference }).eq("id", orderId);
    return NextResponse.json({ orderId, redirectUrl: session.redirectUrl });
  } catch (checkoutError) {
    const admin = createAdminClient();
    await admin.from("checkout_orders").update({ status: "failed" }).eq("id", orderId);
    return NextResponse.json({ error: checkoutError instanceof Error ? checkoutError.message : "Provider unavailable." }, { status: 503 });
  }
}
