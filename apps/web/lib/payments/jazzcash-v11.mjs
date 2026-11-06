import { createHmac, randomBytes, randomUUID } from "node:crypto";

const LINK_WALLET_PATH = "/payment-orchestrator/WalletLinkingPortal/wallet/LinkWallet";
const DEFAULT_HOST = "https://onlinepayments.jazzcash.com.pk";

function requiredEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`${name} is not configured.`);
  return value;
}

export function jazzcashV11Configured() {
  return Boolean(
    process.env.JAZZCASH_MERCHANT_ID?.trim()
    && process.env.JAZZCASH_PASSWORD?.trim()
    && process.env.JAZZCASH_INTEGRITY_SALT?.trim()
    && (process.env.JAZZCASH_RETURN_URL?.trim() || process.env.NEXT_PUBLIC_APP_URL?.trim()),
  );
}

export function jazzcashReturnUrl() {
  const appOrigin = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const configured = process.env.JAZZCASH_RETURN_URL?.trim();
  // Wallet return must hit THIS app's /callback (same DB) or Premium never attaches and Profile stays Free.
  // Staging previously pointed at watch-jalwa.com while the app ran on jalwa-platform.codistan.org.
  if (configured) {
    try {
      if (new URL(configured).host === new URL(appOrigin).host) return configured;
    } catch {
      // fall through to app-origin callback
    }
  }
  return `${appOrigin}/callback`;
}

export function jazzcashHost() {
  return (process.env.JAZZCASH_HOST ?? DEFAULT_HOST).replace(/\/$/, "");
}

export function jazzcashActionUrl() {
  return `${jazzcashHost()}${LINK_WALLET_PATH}`;
}

export function jazzcashPayViaTokenUrl() {
  return `${jazzcashHost()}/payment-orchestrator/api/v4/rest/payments/m-wallet`;
}

/** Status Inquiry — do not send pp_Version (SkillUp hash footgun → response 110). */
export function jazzcashStatusInquiryUrl() {
  return `${jazzcashHost()}/payment-orchestrator/api/v2/rest/payments/status/inquiry`;
}

/**
 * Public IPN URL JazzCash must allowlist.
 * Prefer JAZZCASH_IPN_URL when it matches the live app host; else `{appOrigin}/jazzcash/ipn`.
 */
export function jazzcashIpnUrl() {
  const appOrigin = (process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const configured = process.env.JAZZCASH_IPN_URL?.trim();
  if (configured) {
    try {
      if (new URL(configured).host === new URL(appOrigin).host) return configured;
    } catch {
      // fall through
    }
  }
  return `${appOrigin}/jazzcash/ipn`;
}

/** Asia/Karachi stamp yyyyMMddHHmmss for JazzCash txn fields. */
export function jazzcashPktDateTime(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Karachi",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(date);
  const get = (type) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${get("year")}${get("month")}${get("day")}${get("hour")}${get("minute")}${get("second")}`;
}

/** PayViaToken txn ref: Goo + PKT stamp + hex, max 20 chars (SkillUp). */
export function newJazzcashPayTxnRef() {
  const stamp = jazzcashPktDateTime().slice(-12);
  const hex = randomBytes(1).toString("hex");
  return `Goo${stamp}${hex}`.slice(0, 20);
}

/**
 * Status Inquiry for a prior PayViaToken / wallet txn.
 * Field set is ONLY MerchantID + Password + TxnRefNo + SecureHash (no pp_Version).
 */
export async function inquireJazzcashPaymentStatus({ txnRefNo }) {
  const merchantId = requiredEnv("JAZZCASH_MERCHANT_ID");
  const password = requiredEnv("JAZZCASH_PASSWORD");
  const ref = String(txnRefNo ?? "").trim();
  if (!ref || ref.length > 40) {
    const error = new Error("invalid_txn_ref");
    error.status = 400;
    throw error;
  }

  const fields = {
    pp_MerchantID: merchantId,
    pp_Password: password,
    pp_TxnRefNo: ref,
  };
  fields.pp_SecureHash = buildJazzcashSecureHash(fields);

  const response = await fetch(jazzcashStatusInquiryUrl(), {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(fields),
    signal: AbortSignal.timeout(Number(process.env.JAZZCASH_TIMEOUT_MS ?? 30000)),
  });
  const payload = await response.json().catch(() => ({}));
  const responseCode = String(payload.pp_ResponseCode ?? payload.responseCode ?? "").trim();
  const ok = response.ok && ["000", "121", "200", "0"].includes(responseCode);
  return {
    ok,
    responseCode,
    responseMessage: String(payload.pp_ResponseMessage ?? payload.responseMessage ?? "").slice(0, 200),
    txnRefNo: ref,
    payload: sanitizeJazzcashPublicPayload(payload),
  };
}

/** Strip secrets before returning JazzCash payloads to API callers. */
export function sanitizeJazzcashPublicPayload(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) return {};
  const out = {};
  for (const [key, value] of Object.entries(payload)) {
    if (/password|integrity|salt|securehash|paymenttoken|authtoken|token/i.test(key)) continue;
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean" || value == null) {
      out[key] = value;
    }
  }
  return out;
}

/**
 * Charge a linked wallet token (server-side). Never send MPIN/CNIC.
 * amountMinor is PKR paisa string convention used by JazzCash (59900 = Rs 599.00).
 */
export async function payViaJazzcashToken({
  paymentToken,
  amountMinor,
  billReference,
  description = "Jalwa Premium",
  txnRefNo,
}) {
  const merchantId = requiredEnv("JAZZCASH_MERCHANT_ID");
  const password = requiredEnv("JAZZCASH_PASSWORD");
  const token = String(paymentToken ?? "").trim();
  if (!token) {
    const error = new Error("missing_payment_token");
    error.status = 400;
    throw error;
  }
  const amount = String(Math.trunc(Number(amountMinor)));
  if (!/^[1-9][0-9]*$/.test(amount)) {
    const error = new Error("invalid_amount");
    error.status = 400;
    throw error;
  }

  const txnDateTime = jazzcashPktDateTime();
  const expiry = jazzcashPktDateTime(new Date(Date.now() + 60 * 60 * 1000));
  const resolvedTxnRef = String(txnRefNo ?? newJazzcashPayTxnRef()).slice(0, 20);
  const fields = {
    pp_MerchantID: merchantId,
    pp_Password: password,
    pp_PaymentToken: token,
    pp_TxnRefNo: resolvedTxnRef,
    pp_Amount: amount,
    pp_BillReference: String(billReference ?? `Jalwa${amount.slice(-8)}`).slice(0, 20),
    pp_Description: String(description).slice(0, 200),
    pp_TxnCurrency: "PKR",
    pp_TxnDateTime: txnDateTime,
    pp_TxnExpiryDateTime: expiry,
  };
  fields.pp_SecureHash = buildJazzcashSecureHash(fields);

  const response = await fetch(jazzcashPayViaTokenUrl(), {
    method: "POST",
    headers: { "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify(fields),
    signal: AbortSignal.timeout(Number(process.env.JAZZCASH_TIMEOUT_MS ?? 30000)),
  });
  const payload = await response.json().catch(() => ({}));
  const responseCode = String(payload.pp_ResponseCode ?? payload.responseCode ?? "").trim();
  const ok = response.ok && ["000", "121", "200", "0"].includes(responseCode);
  return {
    ok,
    responseCode,
    responseMessage: String(payload.pp_ResponseMessage ?? payload.responseMessage ?? "").slice(0, 200),
    txnRefNo: fields.pp_TxnRefNo,
    payload,
  };
}

/**
 * JazzCash V11 / MWallet SecureHash (SkillUp-compatible).
 * 1. All non-empty trimmed pp_* except pp_SecureHash
 * 2. Sort by field name ASCII (plain string compare, not localeCompare)
 * 3. Message = IntegritySalt & v1 & v2 & … & vN
 * 4. HMAC-SHA256(key=IntegritySalt) → UPPERCASE hex
 */
export function buildJazzcashSecureHash(fields, integritySalt = process.env.JAZZCASH_INTEGRITY_SALT) {
  if (!integritySalt) throw new Error("JAZZCASH_INTEGRITY_SALT is not configured.");
  const values = Object.entries(fields)
    .filter(
      ([key, value]) =>
        key.startsWith("pp_")
        && key !== "pp_SecureHash"
        && value != null
        && String(value).trim().length > 0,
    )
    .sort(([left], [right]) => (left < right ? -1 : left > right ? 1 : 0))
    .map(([, value]) => String(value).trim());
  const message = [integritySalt, ...values].join("&");
  return createHmac("sha256", integritySalt).update(message, "utf8").digest("hex").toUpperCase();
}

export function verifyJazzcashSecureHash(fields) {
  const provided = String(fields.pp_SecureHash ?? "").trim();
  if (!provided) return false;
  const expected = buildJazzcashSecureHash(fields);
  return provided.toUpperCase() === expected;
}

/**
 * LinkWallet browser form — SkillUp / JazzCash orchestrator field set only.
 * Do not send pp_Version, pp_TxnType, pp_MobileNumber, pp_TxnRefNo, etc.
 */
export function buildLinkWalletForm({ requestId, msisdn }) {
  const merchantId = requiredEnv("JAZZCASH_MERCHANT_ID");
  const password = requiredEnv("JAZZCASH_PASSWORD");
  const returnUrl = jazzcashReturnUrl();
  const digits = String(msisdn ?? "").replace(/\D/g, "");
  const national = digits.startsWith("92") && digits.length === 12
    ? `0${digits.slice(2)}`
    : digits.startsWith("3") && digits.length === 10
      ? `0${digits}`
      : digits;
  if (!/^03\d{9}$/.test(national)) {
    throw new Error("invalid_msisdn");
  }

  const resolvedRequestId = isValidJazzcashRequestId(requestId) ? String(requestId).trim() : newJazzcashRequestId();
  const fields = {
    pp_MerchantID: merchantId,
    pp_Password: password,
    pp_MSISDN: national,
    pp_RequestID: resolvedRequestId,
    pp_ReturnURL: returnUrl,
  };

  fields.pp_SecureHash = buildJazzcashSecureHash(fields);
  return {
    requestId: fields.pp_RequestID,
    actionUrl: jazzcashActionUrl(),
    fields,
  };
}

/** JazzCash LinkWallet pp_RequestID: ReqId + compact unique suffix, max 20 chars. */
export const JAZZCASH_REQUEST_ID_MAX = 20;

export function isValidJazzcashRequestId(value) {
  const id = String(value ?? "").trim();
  return id.length >= 8 && id.length <= JAZZCASH_REQUEST_ID_MAX && /^ReqId[0-9A-Za-z]+$/.test(id);
}

export function newJazzcashRequestId() {
  // SkillUp example is ReqId123. Long free-form IDs (landing+msisdn+epoch) are rejected:
  // "Please provide a valid value for pp_RequestID."
  const stamp = Date.now().toString().slice(-12);
  const hex = randomBytes(1).toString("hex");
  return `ReqId${stamp}${hex}`.slice(0, JAZZCASH_REQUEST_ID_MAX);
}

export function jazzcashOfficialTestVectorHash() {
  // Official JazzCash sample: salt 0F5DD14AE2, values Amount=2995 MerchantID=MER123 Password=A48cvE28
  return buildJazzcashSecureHash(
    {
      pp_Amount: "2995",
      pp_MerchantID: "MER123",
      pp_Password: "A48cvE28",
    },
    "0F5DD14AE2",
  );
}

// Keep UUID helper available for idempotency keys that must stay alphanumeric-only.
export function newJazzcashAlphanumericId() {
  return `JL${randomUUID().replace(/-/g, "").slice(0, 18).toUpperCase()}`;
}
