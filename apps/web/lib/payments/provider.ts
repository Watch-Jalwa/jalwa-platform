export type CheckoutInput = {
  orderId: string;
  amountMinor: number;
  currency: string;
  returnUrl: string;
};

export type CheckoutSession = {
  redirectUrl: string;
  providerOrderReference: string;
};

export async function createHostedCheckout(input: CheckoutInput): Promise<CheckoutSession> {
  const provider = process.env.PAYMENT_PROVIDER ?? "mock";
  if (provider === "mock") {
    return {
      redirectUrl: `${input.returnUrl.replace(/\/billing\/success$/, "")}/checkout/mock?order=${encodeURIComponent(input.orderId)}`,
      providerOrderReference: `mock_${input.orderId}`,
    };
  }

  throw new Error(`${provider} checkout is not configured. Add the merchant adapter before enabling it.`);
}
