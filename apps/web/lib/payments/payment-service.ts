import { Buffer } from "node:buffer";

export type PaymentServicePlan = {
  code: string;
  interval: "weekly" | "monthly" | "yearly";
  fullAmountMinor: number;
  stepAmountMinor: number;
  trialHours: number;
  currency: string;
};

export type PaymentServiceWallet = {
  id?: string;
  status: "none" | "pending" | "linked" | "unlinked" | "failed";
  msisdn_masked?: string | null;
  consented_at?: string | null;
  unlinked_at?: string | null;
  created_at?: string | null;
};

export type PaymentServiceSubscription = {
  id: string;
  plan_code: string;
  amount_minor: number;
  step_amount_minor: number;
  charge_tier?: "full" | "step" | null;
  currency: string;
  interval: "weekly" | "monthly" | "yearly";
  status: "initiated" | "trialing" | "active" | "past_due" | "paused" | "payment_failed" | "expired" | "canceled";
  next_due_at?: string | null;
  current_period_end?: string | null;
  trial_ends_at?: string | null;
};

export type PaymentServiceStatus = {
  wallet: PaymentServiceWallet;
  alreadySubscribed: boolean;
  status: {
    wallet_linked: boolean;
    subscription_status: PaymentServiceSubscription["status"] | null;
    current_period_paid: boolean;
    next_due_at?: string | null;
    last_payment_status?: string | null;
    last_success_at?: string | null;
  };
  subscriptions: PaymentServiceSubscription[];
};

export type PaymentServicePayment = {
  id: string;
  amount_minor: number;
  charge_kind?: "full" | "step" | null;
  currency: string;
  status: "pending" | "completed" | "failed" | "expired" | "refunded";
  txn_ref_no?: string | null;
  response_code?: string | null;
  response_message?: string | null;
  jazzcash_rrn?: string | null;
  created_at: string;
  updated_at?: string | null;
};

export type WalletLinkResponse = {
  requestId: string;
  returnUrl: string;
  portalUrl: string;
  method: "POST";
  fields: Record<string, string>;
};

export type PaymentServiceSubscriptionCreate = PaymentServiceSubscription;

export class PaymentServiceError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = "PaymentServiceError";
    this.status = status;
    this.code = code;
  }
}

const MAX_RESPONSE_BYTES = 512 * 1024;
const DEFAULT_TIMEOUT_MS = 12_000;
const walletStatuses = new Set(["none", "pending", "linked", "unlinked", "failed"]);
const subscriptionStatuses = new Set(["initiated", "trialing", "active", "past_due", "paused", "payment_failed", "expired", "canceled"]);
const intervals = new Set(["weekly", "monthly", "yearly"]);
const paymentStatuses = new Set(["pending", "completed", "failed", "expired", "refunded"]);

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isIsoLike(value: unknown) {
  if (value == null) return true;
  return typeof value === "string" && Number.isFinite(Date.parse(value));
}

function requiredConfiguration() {
  const baseUrl = process.env.PAYMENT_SERVICE_BASE_URL?.trim();
  const apiKey = process.env.PAYMENT_SERVICE_API_KEY?.trim();
  if (!baseUrl || !apiKey) {
    throw new PaymentServiceError(503, "payment_service_unconfigured", "Payment service is not configured.");
  }
  const url = new URL(baseUrl);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new PaymentServiceError(503, "payment_service_unconfigured", "Payment service URL must use HTTPS.");
  }
  return { baseUrl: url.toString().replace(/\/$/, ""), apiKey };
}

export function paymentServiceEnabled() {
  return process.env.PAYMENT_SERVICE_ENABLED === "true";
}

export function paymentServiceAppReturnUrl() {
  const configured = process.env.PAYMENT_SERVICE_APP_RETURN_URL?.trim();
  const appUrl = process.env.APP_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim();
  const candidate = configured || (appUrl ? `${appUrl.replace(/\/$/, "")}/billing/wallet-return` : "");
  if (!candidate) throw new PaymentServiceError(503, "payment_service_unconfigured", "Payment return URL is not configured.");
  const url = new URL(candidate);
  if (url.protocol !== "https:" && url.hostname !== "localhost" && url.hostname !== "127.0.0.1") {
    throw new PaymentServiceError(503, "payment_service_unconfigured", "Payment return URL must use HTTPS.");
  }
  if (url.username || url.password) throw new PaymentServiceError(503, "payment_service_unconfigured", "Payment return URL is invalid.");
  return url.toString();
}

async function paymentServiceRequest(path: string, init: { method?: "GET" | "POST"; body?: unknown } = {}) {
  if (!paymentServiceEnabled()) {
    throw new PaymentServiceError(503, "payment_service_disabled", "Payment service is disabled.");
  }
  const { baseUrl, apiKey } = requiredConfiguration();
  if (!path.startsWith("/v1/")) throw new Error("Payment-service paths must stay under /v1/.");
  const controller = new AbortController();
  const timeout = Number(process.env.PAYMENT_SERVICE_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS);
  const timer = setTimeout(() => controller.abort(), Number.isFinite(timeout) && timeout > 0 ? timeout : DEFAULT_TIMEOUT_MS);
  try {
    let response: Response;
    try {
      response = await fetch(`${baseUrl}${path}`, {
        method: init.method ?? "GET",
        headers: {
          "X-Api-Key": apiKey,
          "Content-Type": "application/json",
          Accept: "application/json",
        },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
        cache: "no-store",
        signal: controller.signal,
      });
    } catch (error) {
      const timeoutError = error instanceof Error && (error.name === "AbortError" || /aborted/i.test(error.message));
      throw new PaymentServiceError(503, timeoutError ? "payment_service_timeout" : "payment_service_unavailable", timeoutError ? "Payment service timed out." : "Payment service is temporarily unavailable.");
    }

    const raw = await response.text();
    if (Buffer.byteLength(raw, "utf8") > MAX_RESPONSE_BYTES) {
      throw new PaymentServiceError(502, "payment_service_invalid_response", "Payment service returned an oversized response.");
    }
    let payload: unknown = {};
    if (raw) {
      try { payload = JSON.parse(raw); }
      catch { throw new PaymentServiceError(502, "payment_service_invalid_response", "Payment service returned invalid JSON."); }
    }
    if (!response.ok) {
      const errorPayload = isObject(payload) ? payload : {};
      const code = typeof errorPayload.error === "string" ? errorPayload.error : "payment_service_error";
      const message = typeof errorPayload.message === "string" ? errorPayload.message : "Payment request could not be completed.";
      throw new PaymentServiceError(response.status, code, message);
    }
    return payload;
  } finally {
    clearTimeout(timer);
  }
}

function parsePlan(value: unknown): PaymentServicePlan {
  if (!isObject(value) || typeof value.code !== "string" || !intervals.has(String(value.interval)) || !Number.isInteger(value.fullAmountMinor) || !Number.isInteger(value.stepAmountMinor) || typeof value.currency !== "string") {
    throw new PaymentServiceError(502, "payment_service_invalid_response", "Payment service returned an invalid plan.");
  }
  const fullAmountMinor = Number(value.fullAmountMinor);
  const stepAmountMinor = Number(value.stepAmountMinor);
  const trialHours = value.trialHours == null ? 24 : Number(value.trialHours);
  if (fullAmountMinor <= 0 || stepAmountMinor <= 0 || stepAmountMinor > fullAmountMinor || !Number.isInteger(trialHours) || trialHours < 0 || trialHours > 720 || !/^[A-Z]{3}$/.test(value.currency)) {
    throw new PaymentServiceError(502, "payment_service_invalid_response", "Payment service returned an invalid plan.");
  }
  return { code: value.code, interval: value.interval as PaymentServicePlan["interval"], fullAmountMinor, stepAmountMinor, trialHours, currency: value.currency };
}

function parseWallet(value: unknown): PaymentServiceWallet {
  if (!isObject(value) || typeof value.status !== "string" || !walletStatuses.has(value.status)) {
    throw new PaymentServiceError(502, "payment_service_invalid_response", "Payment service returned an invalid wallet state.");
  }
  return {
    id: typeof value.id === "string" ? value.id : undefined,
    status: value.status as PaymentServiceWallet["status"],
    msisdn_masked: typeof value.msisdn_masked === "string" ? value.msisdn_masked : null,
    consented_at: typeof value.consented_at === "string" ? value.consented_at : null,
    unlinked_at: typeof value.unlinked_at === "string" ? value.unlinked_at : null,
    created_at: typeof value.created_at === "string" ? value.created_at : null,
  };
}

function parseSubscription(value: unknown): PaymentServiceSubscription {
  if (!isObject(value) || typeof value.id !== "string" || typeof value.plan_code !== "string" || !Number.isInteger(value.amount_minor) || !Number.isInteger(value.step_amount_minor) || typeof value.currency !== "string" || !intervals.has(String(value.interval)) || !subscriptionStatuses.has(String(value.status))) {
    throw new PaymentServiceError(502, "payment_service_invalid_response", "Payment service returned an invalid subscription.");
  }
  if (!isIsoLike(value.next_due_at) || !isIsoLike(value.current_period_end) || !isIsoLike(value.trial_ends_at)) {
    throw new PaymentServiceError(502, "payment_service_invalid_response", "Payment service returned invalid subscription dates.");
  }
  const chargeTier = value.charge_tier == null ? null : value.charge_tier;
  if (chargeTier !== null && chargeTier !== "full" && chargeTier !== "step") {
    throw new PaymentServiceError(502, "payment_service_invalid_response", "Payment service returned an invalid charge tier.");
  }
  return {
    id: value.id,
    plan_code: value.plan_code,
    amount_minor: Number(value.amount_minor),
    step_amount_minor: Number(value.step_amount_minor),
    charge_tier: chargeTier,
    currency: value.currency,
    interval: value.interval as PaymentServiceSubscription["interval"],
    status: value.status as PaymentServiceSubscription["status"],
    next_due_at: typeof value.next_due_at === "string" ? value.next_due_at : null,
    current_period_end: typeof value.current_period_end === "string" ? value.current_period_end : null,
    trial_ends_at: typeof value.trial_ends_at === "string" ? value.trial_ends_at : null,
  };
}

function parseStatus(value: unknown): PaymentServiceStatus {
  if (!isObject(value) || typeof value.alreadySubscribed !== "boolean" || !isObject(value.status) || !Array.isArray(value.subscriptions)) {
    throw new PaymentServiceError(502, "payment_service_invalid_response", "Payment service returned an invalid status response.");
  }
  const status = value.status;
  if (typeof status.wallet_linked !== "boolean" || typeof status.current_period_paid !== "boolean") {
    throw new PaymentServiceError(502, "payment_service_invalid_response", "Payment service returned an invalid billing status.");
  }
  const subscriptionStatus = status.subscription_status == null ? null : status.subscription_status;
  if (subscriptionStatus !== null && (typeof subscriptionStatus !== "string" || !subscriptionStatuses.has(subscriptionStatus))) {
    throw new PaymentServiceError(502, "payment_service_invalid_response", "Payment service returned an invalid subscription status.");
  }
  return {
    wallet: parseWallet(value.wallet),
    alreadySubscribed: value.alreadySubscribed,
    status: {
      wallet_linked: status.wallet_linked,
      subscription_status: subscriptionStatus as PaymentServiceStatus["status"]["subscription_status"],
      current_period_paid: status.current_period_paid,
      next_due_at: typeof status.next_due_at === "string" ? status.next_due_at : null,
      last_payment_status: typeof status.last_payment_status === "string" ? status.last_payment_status : null,
      last_success_at: typeof status.last_success_at === "string" ? status.last_success_at : null,
    },
    subscriptions: value.subscriptions.map(parseSubscription),
  };
}

function parsePayment(value: unknown): PaymentServicePayment {
  if (!isObject(value) || typeof value.id !== "string" || !Number.isInteger(value.amount_minor) || typeof value.currency !== "string" || typeof value.status !== "string" || !paymentStatuses.has(value.status) || typeof value.created_at !== "string" || !Number.isFinite(Date.parse(value.created_at))) {
    throw new PaymentServiceError(502, "payment_service_invalid_response", "Payment service returned an invalid payment.");
  }
  const chargeKind = value.charge_kind == null ? null : value.charge_kind;
  if (chargeKind !== null && chargeKind !== "full" && chargeKind !== "step") {
    throw new PaymentServiceError(502, "payment_service_invalid_response", "Payment service returned an invalid payment tier.");
  }
  return {
    id: value.id,
    amount_minor: Number(value.amount_minor),
    charge_kind: chargeKind,
    currency: value.currency,
    status: value.status as PaymentServicePayment["status"],
    txn_ref_no: typeof value.txn_ref_no === "string" ? value.txn_ref_no : null,
    response_code: typeof value.response_code === "string" ? value.response_code : null,
    response_message: typeof value.response_message === "string" ? value.response_message : null,
    jazzcash_rrn: typeof value.jazzcash_rrn === "string" ? value.jazzcash_rrn : null,
    created_at: value.created_at,
    updated_at: typeof value.updated_at === "string" ? value.updated_at : null,
  };
}

export async function getPaymentServicePlans() {
  const payload = await paymentServiceRequest("/v1/plans");
  if (!Array.isArray(payload)) throw new PaymentServiceError(502, "payment_service_invalid_response", "Payment service returned an invalid plan catalog.");
  return payload.map(parsePlan);
}

export async function linkPaymentServiceWallet(input: { userId: string; msisdn: string; planCode?: string }) {
  const payload = await paymentServiceRequest("/v1/wallets/link", { method: "POST", body: { ...input, appReturnUrl: paymentServiceAppReturnUrl() } });
  if (!isObject(payload) || typeof payload.requestId !== "string" || typeof payload.returnUrl !== "string" || typeof payload.portalUrl !== "string" || payload.method !== "POST" || !isObject(payload.fields)) {
    throw new PaymentServiceError(502, "payment_service_invalid_response", "Payment service returned an invalid wallet link response.");
  }
  const portal = new URL(payload.portalUrl);
  if (portal.protocol !== "https:" && portal.hostname !== "localhost" && portal.hostname !== "127.0.0.1") {
    throw new PaymentServiceError(502, "payment_service_invalid_response", "Payment service returned an unsafe wallet portal URL.");
  }
  const fields: Record<string, string> = {};
  for (const [key, value] of Object.entries(payload.fields)) {
    if (typeof value !== "string" || key.length < 1 || key.length > 100 || value.length > 4096) {
      throw new PaymentServiceError(502, "payment_service_invalid_response", "Payment service returned invalid wallet portal fields.");
    }
    fields[key] = value;
  }
  return { requestId: payload.requestId, returnUrl: payload.returnUrl, portalUrl: portal.toString(), method: "POST" as const, fields } satisfies WalletLinkResponse;
}

export async function getPaymentServiceWallet(userId: string) {
  return parseWallet(await paymentServiceRequest(`/v1/wallets/${encodeURIComponent(userId)}`));
}

export async function unlinkPaymentServiceWallet(userId: string) {
  return paymentServiceRequest("/v1/wallets/unlink", { method: "POST", body: { userId } });
}

export async function getPaymentServiceStatus(userId: string) {
  return parseStatus(await paymentServiceRequest(`/v1/users/${encodeURIComponent(userId)}/status`));
}

export async function createPaymentServiceSubscription(input: { userId: string; planCode: string; skipTrial?: boolean }) {
  return parseSubscription(await paymentServiceRequest("/v1/subscriptions", { method: "POST", body: input }));
}

export async function cancelPaymentServiceSubscription(subscriptionId: string) {
  return paymentServiceRequest(`/v1/subscriptions/${encodeURIComponent(subscriptionId)}/cancel`, { method: "POST" });
}

export async function getPaymentServicePayments(userId: string) {
  const payload = await paymentServiceRequest(`/v1/users/${encodeURIComponent(userId)}/payments`);
  if (!Array.isArray(payload)) throw new PaymentServiceError(502, "payment_service_invalid_response", "Payment service returned invalid payment history.");
  return payload.map(parsePayment);
}

export async function getPaymentServicePayment(paymentId: string) {
  return parsePayment(await paymentServiceRequest(`/v1/payments/${encodeURIComponent(paymentId)}`));
}

export function paymentServiceErrorResponse(error: unknown) {
  if (error instanceof PaymentServiceError) {
    return { status: error.status, body: { error: error.code, message: error.message } };
  }
  return { status: 500, body: { error: "internal_error", message: "Payment request could not be completed." } };
}
