import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPaymentSignature } from "@/lib/payments/signature.mjs";

export type PaymentEvent = {
  eventId: string;
  orderId: string;
  transactionId: string;
  amountMinor: number;
  currency: string;
  provider: "mock" | "payfast" | "jazzcash" | "easypaisa";
};

export async function processPaymentEvent(rawBody: string, signature: string | null, event: PaymentEvent) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret || !verifyPaymentSignature(rawBody, signature, secret)) {
    return { ok: false as const, status: 401, error: "Invalid payment signature." };
  }

  const admin = createAdminClient();
  const { data: order } = await admin.from("checkout_orders").select("provider").eq("id", event.orderId).maybeSingle();
  if (!order || order.provider !== event.provider) {
    return { ok: false as const, status: 400, error: "Payment provider does not match the checkout order." };
  }

  const payloadHash = createHash("sha256").update(rawBody).digest("hex");

  const { error: eventError } = await admin.from("webhook_events").upsert({
    provider: event.provider,
    provider_event_id: event.eventId,
    signature_valid: true,
    payload_hash: payloadHash,
    status: "received",
  }, { onConflict: "provider,provider_event_id", ignoreDuplicates: true });

  if (eventError) return { ok: false as const, status: 500, error: eventError.message };

  const { data, error } = await admin.rpc("activate_paid_order", {
    p_order_id: event.orderId,
    p_provider_event_id: event.eventId,
    p_provider_transaction_id: event.transactionId,
    p_amount_minor: event.amountMinor,
    p_currency: event.currency,
    p_payload_hash: payloadHash,
  });

  if (error) {
    await admin.from("webhook_events").update({ status: "failed", error_message: error.message }).eq("provider", event.provider).eq("provider_event_id", event.eventId);
    return { ok: false as const, status: 400, error: error.message };
  }

  return { ok: true as const, subscriptionId: data };
}
