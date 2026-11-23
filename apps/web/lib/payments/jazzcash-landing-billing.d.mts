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

export function grantPremiumForJazzcashIntent(
  intent: Record<string, unknown>,
  options?: { chargeTxnRef?: string; providerRef?: string },
): Promise<{ subscriptionId: string; alreadyGranted: boolean; endsAt?: string; planName?: string }>;

export function chargeAndGrantJazzcashIntent(
  intent: Record<string, unknown>,
  paymentToken?: string | null,
): Promise<{
  ok: boolean;
  status?: string;
  message?: string;
  alreadyGranted?: boolean;
  subscriptionId?: string;
  planCode?: string;
  planName?: string;
}>;

export function reconcileJazzcashPremiumForUser(
  userId: string,
): Promise<{ attempted: number; granted: number }>;

export function completeJazzcashLandingLink(fields: Record<string, string>): Promise<{
  ok: boolean;
  requestId: string;
  status: string;
  message: string;
  signInHint?: string;
  planCode?: string;
  subscriptionId?: string;
}>;

export function inquireJazzcashLandingStatus(input?: {
  txnRefNo?: string;
  requestId?: string;
}): Promise<{
  ok: boolean;
  requestId: string;
  txnRefNo: string;
  responseCode: string;
  responseMessage: string;
  intentStatus: string;
  subscriptionId: string | null;
  payload: Record<string, unknown>;
}>;

export function handleJazzcashIpn(fields: Record<string, string>): Promise<{
  httpStatus: number;
  body: Record<string, unknown>;
}>;

export function unlinkJazzcashWalletForUser(userId: string): Promise<{
  attempted: number;
  deleted: number;
  skipped: boolean;
  reason?: string;
  results?: Array<Record<string, unknown>>;
}>;
