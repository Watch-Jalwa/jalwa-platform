export function lookupPremiumByJazzcashMsisdn(msisdn: string): Promise<{
  ok: true;
  hasSubscription: boolean;
  msisdnMasked: string;
  planName?: string;
  message: string;
}>;

export function unsubscribePremiumByJazzcashMsisdn(
  msisdn: string,
  options?: { source?: string },
): Promise<{
  ok: boolean;
  error?: string;
  msisdnMasked?: string;
  message: string;
}>;

export function stopPremiumForUser(
  userId: string,
  options?: { source?: string; msisdn?: string | null },
): Promise<{ ok: boolean; message?: string }>;
