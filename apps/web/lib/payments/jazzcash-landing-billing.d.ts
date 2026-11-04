export function startJazzcashLandingLink(input: {
  msisdn: string;
  planCode: string;
  consentToAutoPay: boolean;
  attribution?: Record<string, unknown>;
  idempotencyKey?: string;
}): Promise<{
  checkoutMode: string;
  requestId: string;
  actionUrl: string;
  fields: Record<string, string>;
}>;

export function completeJazzcashLandingLink(fields: Record<string, string>): Promise<{
  ok: boolean;
  requestId: string;
  status: string;
  message: string;
  signInHint?: string;
  planCode?: string;
}>;
