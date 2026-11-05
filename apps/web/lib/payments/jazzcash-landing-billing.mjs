import { databasePool } from "@/lib/database/pool";
import {
  buildLinkWalletForm,
  isValidJazzcashRequestId,
  jazzcashV11Configured,
  newJazzcashRequestId,
  payViaJazzcashToken,
  verifyJazzcashSecureHash,
} from "./jazzcash-v11.mjs";
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

async function loadPriceForPlanCode(planCode) {
  const result = await databasePool.query(
    `select pr.id as price_id,
            pr.code as price_code,
            pr.amount_minor,
            pr.currency,
            pr.duration_days,
            pr.billing_period,
            p.id as plan_id,
            p.code as plan_code,
            p.name as plan_name,
            p.benefits
     from public.prices pr
     join public.plans p on p.id = pr.plan_id
     where pr.code = $1
       and pr.is_active = true
       and p.is_active = true
     limit 1`,
    [planCode],
  );
  return result.rows[0] ?? null;
}

/**
 * Charge a stored/returned JazzCash payment token then grant Premium on the phone-bound user.
 * Idempotent when intent.subscription_id is already set. Skips re-charge when a prior charge succeeded.
 */
export async function chargeAndGrantJazzcashIntent(intent, paymentToken) {
  if (intent.subscription_id) {
    return {
      ok: true,
      alreadyGranted: true,
      subscriptionId: intent.subscription_id,
      planCode: intent.plan_code,
    };
  }

  const token = String(paymentToken ?? intent.payment_token ?? "").trim();
  const priorChargeOk = Boolean(intent.charge_txn_ref)
    && ["000", "121", "200", "0"].includes(String(intent.charge_response_code ?? "").trim());

  let chargeTxnRef = priorChargeOk ? intent.charge_txn_ref : null;

  if (!priorChargeOk) {
    if (!token) {
      return {
        ok: false,
        status: "failed",
        message: "JazzCash did not return a payment token. Premium was not activated.",
      };
    }

    const price = await loadPriceForPlanCode(intent.plan_code);
    if (!price) {
      return {
        ok: false,
        status: "failed",
        message: "Premium plan price is not configured.",
      };
    }

    const trialMinor = Number(process.env.JAZZCASH_TRIAL_AMOUNT_MINOR ?? "0");
    const amountMinor = trialMinor > 0 ? trialMinor : Number(price.amount_minor);

    let charge;
    try {
      charge = await payViaJazzcashToken({
        paymentToken: token,
        amountMinor,
        billReference: String(intent.request_id).slice(0, 20),
        description: `Jalwa ${price.plan_name}`,
      });
    } catch (error) {
      await databasePool.query(
        `update public.jazzcash_wallet_link_intents
         set payment_token = coalesce(payment_token, $2),
             charge_response_code = $3,
             response_message = $4,
             updated_at = now()
         where request_id = $1`,
        [
          intent.request_id,
          token,
          "charge_error",
          String(error instanceof Error ? error.message : error).slice(0, 200),
        ],
      );
      return {
        ok: false,
        status: "failed",
        message: "JazzCash charge could not be started. Premium was not activated.",
      };
    }

    await databasePool.query(
      `update public.jazzcash_wallet_link_intents
       set payment_token = coalesce(payment_token, $2),
           charge_txn_ref = $3,
           charge_response_code = $4,
           response_message = $5,
           charged_at = case when $6 then now() else charged_at end,
           updated_at = now()
       where request_id = $1`,
      [
        intent.request_id,
        token,
        charge.txnRefNo,
        charge.responseCode.slice(0, 40) || null,
        charge.responseMessage || null,
        charge.ok,
      ],
    );

    if (!charge.ok) {
      return {
        ok: false,
        status: "failed",
        message: charge.responseMessage || "JazzCash charge failed. Premium was not activated.",
      };
    }

    chargeTxnRef = charge.txnRefNo;
  }

  const granted = await grantPremiumForJazzcashIntent(intent, {
    chargeTxnRef,
    providerRef: chargeTxnRef,
  });

  return {
    ok: true,
    alreadyGranted: granted.alreadyGranted,
    subscriptionId: granted.subscriptionId,
    planCode: intent.plan_code,
    planName: granted.planName,
  };
}

/**
 * After phone signup/signin, finish any completed JazzCash links that still lack Premium.
 * Safe to call on every login; never throws to the auth caller.
 */
export async function reconcileJazzcashPremiumForUser(userId) {
  if (!userId || paymentServiceEnabled()) {
    return { attempted: 0, granted: 0 };
  }

  const pending = await databasePool.query(
    `select *
     from public.jazzcash_wallet_link_intents
     where user_id = $1
       and status = 'completed'
       and subscription_id is null
       and (
         payment_token is not null
         or (
           charge_txn_ref is not null
           and charge_response_code in ('000', '121', '200', '0')
         )
       )
     order by completed_at desc nulls last, created_at desc
     limit 5`,
    [userId],
  );

  let granted = 0;
  for (const intent of pending.rows) {
    try {
      const result = await chargeAndGrantJazzcashIntent(intent, intent.payment_token);
      if (result.ok) granted += 1;
    } catch {
      // Keep login available; charge can be retried on the next sign-in.
    }
  }

  return { attempted: pending.rows.length, granted };
}

/**
 * Create/refresh local subscription + entitlements on the phone-bound checkout user.
 * Idempotent per intent: if subscription_id already set, return it.
 */
export async function grantPremiumForJazzcashIntent(intent, { chargeTxnRef, providerRef } = {}) {
  if (intent.subscription_id) {
    return { subscriptionId: intent.subscription_id, alreadyGranted: true };
  }

  const price = await loadPriceForPlanCode(intent.plan_code);
  if (!price) {
    const error = new Error("unknown_plan_price");
    error.status = 500;
    throw error;
  }

  const client = await databasePool.connect();
  try {
    await client.query("begin");

    const existing = await client.query(
      `select subscription_id from public.jazzcash_wallet_link_intents where request_id = $1 for update`,
      [intent.request_id],
    );
    if (existing.rows[0]?.subscription_id) {
      await client.query("commit");
      return { subscriptionId: existing.rows[0].subscription_id, alreadyGranted: true };
    }

    const endsAt = new Date(Date.now() + Number(price.duration_days) * 24 * 60 * 60 * 1000).toISOString();
    const inserted = await client.query(
      `insert into public.subscriptions(
         user_id, plan_id, provider, provider_subscription_id, status,
         current_period_start, current_period_end, cancel_at_period_end,
         auto_renew_consented, auto_renew_consented_at, price_snapshot
       ) values (
         $1, $2, 'jazzcash', $3, 'active',
         now(), $4::timestamptz, false,
         true, now(),
         jsonb_build_object(
           'code', $5,
           'currency', $6,
           'amountMinor', $7,
           'billingPeriod', $8,
           'chargeTxnRef', $9
         )
       )
       returning id::text as id`,
      [
        intent.user_id,
        price.plan_id,
        String(providerRef ?? chargeTxnRef ?? intent.request_id).slice(0, 120),
        endsAt,
        price.price_code,
        price.currency,
        price.amount_minor,
        price.billing_period,
        chargeTxnRef ?? null,
      ],
    );
    const subscriptionId = inserted.rows[0]?.id;
    if (!subscriptionId) throw new Error("subscription_insert_failed");

    await client.query(
      `insert into public.entitlements(user_id, benefit_code, starts_at, ends_at, source_type, source_id, status)
       select $1, benefit, now(), $3::timestamptz, 'subscription', $2::uuid, 'active'::public.entitlement_status
       from unnest($4::text[]) as benefit
       on conflict (user_id, benefit_code, source_type, source_id)
       do update set
         starts_at = least(public.entitlements.starts_at, excluded.starts_at),
         ends_at = greatest(public.entitlements.ends_at, excluded.ends_at),
         status = 'active',
         updated_at = now()`,
      [intent.user_id, subscriptionId, endsAt, price.benefits],
    );

    await client.query(
      `update public.jazzcash_wallet_link_intents
       set subscription_id = $2::uuid,
           charge_txn_ref = coalesce(charge_txn_ref, $3),
           charged_at = coalesce(charged_at, now()),
           updated_at = now()
       where request_id = $1`,
      [intent.request_id, subscriptionId, chargeTxnRef ?? null],
    );

    await client.query(
      `insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
       values ($1, 'jazzcash_payfirst_premium_granted', 'subscription', $2,
               jsonb_build_object(
                 'requestId', $3,
                 'planCode', $4,
                 'chargeTxnRef', $5,
                 'msisdn', $6
               ))`,
      [intent.user_id, subscriptionId, intent.request_id, intent.plan_code, chargeTxnRef ?? null, intent.msisdn],
    );

    await client.query("commit");
    return { subscriptionId, alreadyGranted: false, endsAt, planName: price.plan_name };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
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
  const requestId = isValidJazzcashRequestId(idempotencyKey)
    ? String(idempotencyKey).trim()
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
  const paymentToken = String(fields.pp_PaymentToken ?? "").trim();
  const success = ["000", "121", "200", "0"].includes(responseCode) || Boolean(paymentToken);
  const tokenPresent = Boolean(paymentToken);

  await databasePool.query(
    `update public.jazzcash_wallet_link_intents
     set status = $2,
         payment_token_present = $3,
         payment_token = case when $3 and $6 <> '' then $6 else payment_token end,
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
      paymentToken,
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

  // Already granted on a prior callback replay.
  if (intent.subscription_id) {
    return {
      ok: true,
      requestId,
      status: "completed",
      message: "Premium already active on this JazzCash number. Sign in with the same mobile number.",
      signInHint: intent.msisdn,
      planCode: intent.plan_code,
      subscriptionId: intent.subscription_id,
    };
  }

  if (paymentServiceEnabled()) {
    // Payment-service path: wallet link only; entitlement arrives via signed webhook.
    return {
      ok: true,
      requestId,
      status: "completed",
      message: "JazzCash wallet linked. Premium activates after the payment service confirms the charge.",
      signInHint: intent.msisdn,
      planCode: intent.plan_code,
    };
  }

  const charged = await chargeAndGrantJazzcashIntent(
    { ...intent, payment_token: paymentToken || intent.payment_token },
    paymentToken,
  );

  if (!charged.ok) {
    return {
      ok: false,
      requestId,
      status: "failed",
      message: charged.message,
      signInHint: intent.msisdn,
    };
  }

  return {
    ok: true,
    requestId,
    status: "completed",
    message: "Premium activated for this JazzCash number. Sign in with the same mobile number to open Jalwa Premium.",
    signInHint: intent.msisdn,
    planCode: intent.plan_code,
    subscriptionId: charged.subscriptionId,
  };
}
