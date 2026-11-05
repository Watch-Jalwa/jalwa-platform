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
  return (
    process.env.JAZZCASH_RETURN_URL?.trim()
    || `${(process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "")}/callback`
  );
}

export function jazzcashActionUrl() {
  const host = (process.env.JAZZCASH_HOST ?? DEFAULT_HOST).replace(/\/$/, "");
  return `${host}${LINK_WALLET_PATH}`;
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

  const fields = {
    pp_MerchantID: merchantId,
    pp_Password: password,
    pp_MSISDN: national,
    pp_RequestID: String(requestId).trim(),
    pp_ReturnURL: returnUrl,
  };

  fields.pp_SecureHash = buildJazzcashSecureHash(fields);
  return {
    requestId: fields.pp_RequestID,
    actionUrl: jazzcashActionUrl(),
    fields,
  };
}

/** SkillUp-style request id: ReqId + timestamp + hex (unique, hashed as pp_RequestID). */
export function newJazzcashRequestId() {
  const stamp = Date.now().toString(36);
  const hex = randomBytes(4).toString("hex");
  return `ReqId${stamp}${hex}`.slice(0, 40);
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
