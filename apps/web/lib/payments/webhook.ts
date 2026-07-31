import { createHash } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyPaymentSignature } from "@/lib/payments/signature.mjs";

export type PaymentEventStatus = "succeeded" | "failed" | "refunded" | "partially_refunded" | "disputed";
export type PaymentEvent = {
  eventId: string;
  orderId: string;
  transactionId: string;
  amountMinor: number;
  currency: string;
  status: PaymentEventStatus;
  reason?: string | null;
  provider: "payfast" | "jazzcash" | "easypaisa";
};

type PaymentLifecycleResult = {
  orderId?: string;
  subscriptionId?: string | null;
  eventStatus?: PaymentEventStatus;
  processingStatus?: "processed" | "review_required";
  idempotent?: boolean;
};

export async function processPaymentEvent(rawBody: string, signature: string | null, event: PaymentEvent) {
  const secret = process.env.PAYMENT_WEBHOOK_SECRET;
  if (!secret || !verifyPaymentSignature(rawBody, signature, secret)) {
    return { ok: false as const, status: 401, error: "Invalid payment signature." };
  }

  const admin = createAdminClient();
  const { data: order, error: orderError } = await admin.from("checkout_orders").select("provider").eq("id", event.orderId).maybeSingle();
  if (orderError) return { ok: false as const, status: 503, error: "Payment order validation is temporarily unavailable." };
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

  const { data, error } = await admin.rpc("process_payment_lifecycle_event", {
    p_order_id: event.orderId,
    p_provider: event.provider,
    p_provider_event_id: event.eventId,
    p_provider_transaction_id: event.transactionId,
    p_event_status: event.status,
    p_amount_minor: event.amountMinor,
    p_currency: event.currency,
    p_payload_hash: payloadHash,
    p_reason: event.reason ?? null,
  });

  if (error) {
    await admin.from("webhook_events").update({ status: "failed", error_message: error.message }).eq("provider", event.provider).eq("provider_event_id", event.eventId);
    return { ok: false as const, status: 400, error: error.message };
  }

  return { ok: true as const, result: (data ?? {}) as PaymentLifecycleResult };
}
