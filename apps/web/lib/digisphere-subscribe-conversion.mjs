/**
 * Digisphere / Codistan payment-service Subscribe conversion (playbook §7).
 * Digisphere return has no JazzCash order/cv — synthesize a stable event_id.
 * Marketing only — never entitlement proof.
 */

import { trackLandingPaymentSuccess } from "./landing-analytics.mjs";

export const DIGISPHERE_PENDING_KEY = "jalwa.digisphere.pendingCheckout";

/**
 * Persist non-secret pending checkout after wallets/link success.
 * @param {{ requestId?: string, checkoutMode?: string, planCode?: string, landing?: string, utm?: string, parameter?: string }} pending
 */
export function saveDigispherePendingCheckout(pending) {
  try {
    if (typeof sessionStorage === "undefined") return;
    const requestId = String(pending?.requestId ?? "").trim();
    if (!requestId) return;
    sessionStorage.setItem(
      DIGISPHERE_PENDING_KEY,
      JSON.stringify({
        requestId,
        checkoutMode: String(pending?.checkoutMode ?? "payment-service"),
        planCode: String(pending?.planCode ?? "premium-monthly-pkr"),
        landing: pending?.landing ? String(pending.landing) : undefined,
        utm: pending?.utm ? String(pending.utm) : undefined,
        parameter: pending?.parameter ? String(pending.parameter) : undefined,
        startedAt: Date.now(),
      }),
    );
  } catch {
    /* ignore */
  }
}

export function readDigispherePendingCheckout() {
  try {
    if (typeof sessionStorage === "undefined") return null;
    const raw = sessionStorage.getItem(DIGISPHERE_PENDING_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed;
  } catch {
    return null;
  }
}

export function clearDigispherePendingCheckout() {
  try {
    if (typeof sessionStorage !== "undefined") sessionStorage.removeItem(DIGISPHERE_PENDING_KEY);
  } catch {
    /* ignore */
  }
}

/**
 * Build Subscribe event_id for Digisphere returns (playbook §7).
 * Prefer URL order/txn/requestId → pending requestId → digisphere:{userId}:{trialEndsAt}.
 */
export function resolveDigisphereOrderId(query = {}, pending = null) {
  const fromUrl = [
    query.order,
    query.txnRefNo,
    query.requestId,
    query.paymentId,
  ]
    .map((v) => String(v ?? "").trim())
    .find(Boolean);
  if (fromUrl) return fromUrl.slice(0, 100);

  const pendingId = String(pending?.requestId ?? "").trim();
  if (pendingId) return pendingId.slice(0, 100);

  const userId = String(query.userId ?? "").trim();
  const trialEndsAt = String(query.trialEndsAt ?? "").trim();
  if (userId && trialEndsAt) {
    return `digisphere:${userId}:${trialEndsAt}`.slice(0, 100);
  }
  if (userId) return `digisphere:${userId}`.slice(0, 100);
  return "";
}

/**
 * Fire Subscribe once when Digisphere return says wallet=linked (or payment succeeded).
 * Does not require DIY conversion receipt / cv.
 */
export function fireDigisphereSubscribeFromReturn(searchParams) {
  try {
    const query =
      searchParams instanceof URLSearchParams
        ? Object.fromEntries(searchParams.entries())
        : (searchParams ?? {});
    const wallet = String(query.wallet ?? query.payment ?? "").trim().toLowerCase();
    if (wallet !== "linked" && wallet !== "succeeded" && wallet !== "success") {
      return { fired: false, reason: "not_linked" };
    }
    const pending = readDigispherePendingCheckout();
    const orderId = resolveDigisphereOrderId(query, pending);
    if (!orderId) return { fired: false, reason: "no_order_id" };

    const planCode =
      String(pending?.planCode ?? "").trim() ||
      String(query.planCode ?? "").trim() ||
      "premium-monthly-pkr";

    trackLandingPaymentSuccess({
      orderId,
      planCode,
      landing: pending?.landing,
      utm: pending?.utm,
      parameter: pending?.parameter,
      checkoutMode: "digisphere",
    });
    clearDigispherePendingCheckout();
    return { fired: true, orderId };
  } catch {
    return { fired: false, reason: "error" };
  }
}
