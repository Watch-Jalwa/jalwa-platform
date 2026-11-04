import { createHmac, randomUUID } from "node:crypto";

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

/** SecureHash: IntegritySalt & sorted non-empty pp_* values (excluding pp_SecureHash), HMAC-SHA256 uppercase hex. */
export function buildJazzcashSecureHash(fields, integritySalt = process.env.JAZZCASH_INTEGRITY_SALT) {
  if (!integritySalt) throw new Error("JAZZCASH_INTEGRITY_SALT is not configured.");
  const pairs = Object.entries(fields)
    .filter(([key, value]) => key.startsWith("pp_") && key !== "pp_SecureHash" && value != null && String(value) !== "")
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  const message = [integritySalt, ...pairs.map(([, value]) => String(value))].join("&");
  return createHmac("sha256", integritySalt).update(message, "utf8").digest("hex").toUpperCase();
}

export function verifyJazzcashSecureHash(fields) {
  const provided = String(fields.pp_SecureHash ?? "");
  if (!provided) return false;
  const expected = buildJazzcashSecureHash(fields);
  return provided.toUpperCase() === expected;
}

export function buildLinkWalletForm({ requestId, msisdn, description = "Jalwa Premium" }) {
  const merchantId = requiredEnv("JAZZCASH_MERCHANT_ID");
  const password = requiredEnv("JAZZCASH_PASSWORD");
  const returnUrl = jazzcashReturnUrl();
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  const txnDateTime = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;

  const fields = {
    pp_Version: "1.1",
    pp_TxnType: "WUL",
    pp_Language: "EN",
    pp_MerchantID: merchantId,
    pp_Password: password,
    pp_TxnRefNo: requestId,
    pp_MobileNumber: msisdn,
    pp_ReturnURL: returnUrl,
    pp_Description: description.slice(0, 200),
    pp_TxnDateTime: txnDateTime,
  };

  fields.pp_SecureHash = buildJazzcashSecureHash(fields);
  return {
    requestId,
    actionUrl: jazzcashActionUrl(),
    fields,
  };
}

export function newJazzcashRequestId() {
  return `JL${randomUUID().replace(/-/g, "").slice(0, 18).toUpperCase()}`;
}
