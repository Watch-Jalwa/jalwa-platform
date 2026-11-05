import { databasePool } from "@/lib/database/pool";
import { buildLinkWalletForm, jazzcashV11Configured, newJazzcashRequestId, verifyJazzcashSecureHash } from "./jazzcash-v11.mjs";
import { resolveOrCreatePhoneLearnerForCheckout } from "./phone-checkout-user.mjs";
import { paymentServiceEnabled, linkPaymentServiceWallet } from "./payment-service";

function sanitizeAttribution(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const allow = ["utm", "utm_source", "utm_medium", "utm_campaign", "utm_content", "package", "parameter", "payment", "ref", "landing", "landingPath", "he"];
  const out = {};
  for (const key of allow) {
    if (typeof raw[key] === "string" && raw[key].trim()) {
      out[key] = raw[key].trim().slice(0, key === "landingPath" ? 120 : 80);
    }
  }
  return out;
}

export async function startJazzcashLandingLink({ msisdn, planCode, consentToAutoPay, attribution, idempotencyKey }) {
  if (!consentToAutoPay) {
    const error = new Error("consent_required");
    error.status = 400;
    throw error;
  }
  if (!/^[0-9]{11,15}$/.test(String(msisdn ?? ""))) {
    const error = new Error("invalid_msisdn");
    error.status = 400;
    throw error;
  }
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(String(planCode ?? ""))) {
    const error = new Error("invalid_plan");
    error.status = 400;
    throw error;
  }

  const learner = await resolveOrCreatePhoneLearnerForCheckout(msisdn);
  const attr = sanitizeAttribution(attribution);
  const requestId = String(idempotencyKey ?? "").trim().length >= 12
    ? String(idempotencyKey).trim().slice(0, 40)
    : newJazzcashRequestId();

  await databasePool.query(
    `insert into public.jazzcash_wallet_link_intents (request_id, user_id, msisdn, plan_code, landing, attribution, status)
     values ($1, $2, $3, $4, $5, $6::jsonb, 'started')
     on conflict (request_id) do update
       set updated_at = now(),
           attribution = excluded.attribution,
           plan_code = excluded.plan_code,
           status = 'started'`,
    [requestId, learner.userId, learner.msisdn, planCode, attr.landing ?? null, JSON.stringify(attr)],
  );

  if (attr && Object.keys(attr).length) {
    await databasePool.query(
      `update public.profiles set premium_attribution = $2::jsonb, updated_at = now() where id = $1`,
      [learner.userId, JSON.stringify(attr)],
    );
  }

  if (paymentServiceEnabled()) {
    const linked = await linkPaymentServiceWallet({
      userId: learner.userId,
      msisdn: learner.msisdn,
      planCode,
    });
    return {
      checkoutMode: "payment-service",
      requestId: linked.requestId,
      actionUrl: linked.portalUrl,
      fields: linked.fields,
    };
  }

  if (!jazzcashV11Configured()) {
    const error = new Error("jazzcash_unconfigured");
    error.status = 503;
    throw error;
  }

  const form = buildLinkWalletForm({
    requestId,
    msisdn: learner.msisdn,
  });

  return {
    checkoutMode: "jazzcash-v11",
    requestId: form.requestId,
    actionUrl: form.actionUrl,
    fields: form.fields,
  };
}

export async function completeJazzcashLandingLink(fields) {
  if (!fields || typeof fields !== "object") {
    const error = new Error("invalid_fields");
    error.status = 400;
    throw error;
  }

  // LinkWallet V11 returns pp_RequestID; accept legacy pp_TxnRefNo during transition.
  const requestId = String(fields.pp_RequestID ?? fields.pp_TxnRefNo ?? "").trim();
  if (!requestId) {
    const error = new Error("missing_request_id");
    error.status = 400;
    throw error;
  }

  if (jazzcashV11Configured() && fields.pp_SecureHash && !verifyJazzcashSecureHash(fields)) {
    const error = new Error("invalid_hash");
    error.status = 400;
    throw error;
  }

  const intentResult = await databasePool.query(
    `select * from public.jazzcash_wallet_link_intents where request_id = $1 limit 1`,
    [requestId],
  );
  const intent = intentResult.rows[0];
  if (!intent) {
    const error = new Error("unknown_request");
    error.status = 404;
    throw error;
  }

  const responseCode = String(fields.pp_ResponseCode ?? fields.pp_Status ?? "").trim();
  const success = ["000", "121", "200", "0"].includes(responseCode) || Boolean(fields.pp_PaymentToken);
  const tokenPresent = Boolean(String(fields.pp_PaymentToken ?? "").trim());

  await databasePool.query(
    `update public.jazzcash_wallet_link_intents
     set status = $2,
         payment_token_present = $3,
         response_code = $4,
         response_message = $5,
         completed_at = case when $2 = 'completed' then now() else completed_at end,
         updated_at = now()
     where request_id = $1`,
    [
      requestId,
      success ? "completed" : "failed",
      tokenPresent,
      responseCode.slice(0, 40) || null,
      String(fields.pp_ResponseMessage ?? "").slice(0, 200) || null,
    ],
  );

  if (!success) {
    return {
      ok: false,
      requestId,
      status: "failed",
      message: String(fields.pp_ResponseMessage ?? "JazzCash wallet linking did not complete."),
      signInHint: intent.msisdn,
    };
  }

  // Entitlement activation remains payment-service / webhook authoritative when enabled.
  // For direct JazzCash v11 sandbox returns we mark the intent completed and ask the user to sign in.
  return {
    ok: true,
    requestId,
    status: "completed",
    message: "JazzCash wallet linked. Sign in with the same mobile number to open Premium.",
    signInHint: intent.msisdn,
    planCode: intent.plan_code,
  };
}
