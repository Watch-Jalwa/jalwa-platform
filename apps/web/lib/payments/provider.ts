import { createHmac } from "node:crypto";

export type PaymentProvider = "mock" | "payfast" | "jazzcash" | "easypaisa";
export type CheckoutInput = {
  orderId: string;
  amountMinor: number;
  currency: string;
  returnUrl: string;
  webhookUrl?: string;
  customerEmail?: string | null;
};
export type CheckoutSession = { redirectUrl: string; providerOrderReference: string };

const configs: Record<Exclude<PaymentProvider, "mock">, { endpoint: string; secret: string; merchantId: string }> = {
  payfast: { endpoint: "PAYFAST_CHECKOUT_URL", secret: "PAYFAST_SECRET", merchantId: "PAYFAST_MERCHANT_ID" },
  jazzcash: { endpoint: "JAZZCASH_CHECKOUT_URL", secret: "JAZZCASH_SECRET", merchantId: "JAZZCASH_MERCHANT_ID" },
  easypaisa: { endpoint: "EASYPAISA_CHECKOUT_URL", secret: "EASYPAISA_SECRET", merchantId: "EASYPAISA_STORE_ID" },
};

function assertRedirectUrl(value: unknown) {
  if (typeof value !== "string") throw new Error("Payment adapter returned no redirect URL.");
  const url = new URL(value);
  if (url.protocol !== "https:" && url.hostname !== "localhost") throw new Error("Payment checkout must use HTTPS.");
  return url.toString();
}

export async function createHostedCheckout(input: CheckoutInput): Promise<CheckoutSession> {
  const provider = (process.env.PAYMENT_PROVIDER ?? "mock") as PaymentProvider;
  if (provider === "mock") return { redirectUrl: `${input.returnUrl.replace(/\/billing\/success$/, "")}/checkout/mock?order=${encodeURIComponent(input.orderId)}`, providerOrderReference: `mock_${input.orderId}` };
  const config = configs[provider];
  if (!config) throw new Error(`Unsupported payment provider: ${provider}`);
  const endpoint = process.env[config.endpoint];
  const secret = process.env[config.secret];
  const merchantId = process.env[config.merchantId];
  if (!endpoint || !secret || !merchantId) throw new Error(`${provider} merchant adapter is not configured.`);

  const payload = JSON.stringify({ provider, orderId: input.orderId, amountMinor: input.amountMinor, currency: input.currency, returnUrl: input.returnUrl, webhookUrl: input.webhookUrl, customerEmail: input.customerEmail, merchantId });
  const signature = createHmac("sha256", secret).update(payload).digest("hex");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), Number(process.env.PAYMENT_ADAPTER_TIMEOUT_MS ?? 12000));
  try {
    const response = await fetch(endpoint, { method: "POST", headers: { "content-type": "application/json", "x-jalwa-signature": signature, "x-jalwa-order-id": input.orderId }, body: payload, signal: controller.signal, cache: "no-store" });
    const result = await response.json().catch(() => ({})) as { redirectUrl?: unknown; providerOrderReference?: unknown; error?: string };
    if (!response.ok) throw new Error(result.error ?? `${provider} checkout could not be created.`);
    if (typeof result.providerOrderReference !== "string" || !result.providerOrderReference) throw new Error("Payment adapter returned no order reference.");
    return { redirectUrl: assertRedirectUrl(result.redirectUrl), providerOrderReference: result.providerOrderReference };
  } finally { clearTimeout(timer); }
}
