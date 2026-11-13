import { databasePool } from "@/lib/database/pool";
import {
  buildLinkWalletForm,
  deleteJazzcashPaymentToken,
  inquireJazzcashPaymentStatus,
  inquireJazzcashPaymentToken,
  isValidJazzcashRequestId,
  jazzcashV11Configured,
  newJazzcashPayTxnRef,
  newJazzcashRequestId,
  normalizeJazzcashNationalMsisdn,
  payViaJazzcashToken,
  verifyJazzcashSecureHash,
} from "./jazzcash-v11.mjs";
import { nationalMsisdn, resolveOrCreatePhoneLearnerForCheckout } from "./phone-checkout-user.mjs";
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

function mockJazzcashChargeAllowed() {
  // Staging wallet-link callbacks are often dropped by JazzCash allowlisting; keep a local
  // mock charge path so same-MSISDN sign-in can still attach Monthly/Premium.
  return process.env.ALLOW_MOCK_PAYMENTS === "true"
    || process.env.JAZZCASH_MOCK_CHARGE === "true"
    || process.env.DEPLOYMENT_ENVIRONMENT === "staging";
}

function extractJazzcashPaymentToken(fields) {
  if (!fields || typeof fields !== "object") return "";
  for (const key of ["pp_PaymentToken", "pp_AuthToken", "pp_Token", "PaymentToken"]) {
    const value = String(fields[key] ?? "").trim();
    if (value) return value;
  }
  return "";
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

async function transferJazzcashSubscriptionToUser(subscriptionId, fromUserId, toUserId) {
  if (!subscriptionId || !toUserId || fromUserId === toUserId) return;
  const client = await databasePool.connect();
  try {
    await client.query("begin");
    await client.query(
      `update public.subscriptions set user_id = $2, updated_at = now() where id = $1::uuid and user_id = $3`,
      [subscriptionId, toUserId, fromUserId],
    );
    await client.query(
      `update public.entitlements set user_id = $2, updated_at = now()
       where source_type = 'subscription' and source_id = $1::uuid and user_id = $3`,
      [subscriptionId, toUserId, fromUserId],
    );
    await client.query(
      `update public.jazzcash_wallet_link_intents
       set user_id = $2, updated_at = now()
       where subscription_id = $1::uuid`,
      [subscriptionId, toUserId],
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Charge a stored/returned JazzCash payment token then grant Premium on the phone-bound user.
 * Idempotent when intent.subscription_id is already set. Skips re-charge when a prior charge succeeded.
 * Staging may fall back to a local mock charge when ALLOW_MOCK_PAYMENTS / JAZZCASH_MOCK_CHARGE is true.
 */
export async function chargeAndGrantJazzcashIntent(intent, paymentToken, { userId } = {}) {
  const targetUserId = userId || intent.user_id;

  if (intent.subscription_id) {
    if (targetUserId && intent.user_id && String(intent.user_id) !== String(targetUserId)) {
      await transferJazzcashSubscriptionToUser(intent.subscription_id, intent.user_id, targetUserId);
    }
    return {
      ok: true,
      alreadyGranted: true,
      subscriptionId: intent.subscription_id,
      planCode: intent.plan_code,
    };
  }

  const token = String(paymentToken ?? intent.payment_token ?? "").trim();
  const priorChargeOk = Boolean(intent.charge_txn_ref)
    && (
      ["000", "121", "200", "0"].includes(String(intent.charge_response_code ?? "").trim())
      || String(intent.charge_response_code ?? "").startsWith("mock")
    );

  let chargeTxnRef = priorChargeOk ? intent.charge_txn_ref : null;

  if (!priorChargeOk) {
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
    let usedMock = false;

    if (token) {
      const billReference = String(intent.request_id).slice(0, 20);
      const description = `Jalwa ${price.plan_name}`;
      let charge;
      try {
        charge = await payViaJazzcashToken({
          paymentToken: token,
          amountMinor,
          billReference,
          description,
        });
        // Some merchant configs expect whole rupees instead of paisa.
        if (!charge.ok && Number(amountMinor) >= 100 && Number(amountMinor) % 100 === 0) {
          charge = await payViaJazzcashToken({
            paymentToken: token,
            amountMinor: Math.trunc(Number(amountMinor) / 100),
            billReference,
            description,
            txnRefNo: newJazzcashPayTxnRef(),
          });
        }
      } catch (error) {
        charge = {
          ok: false,
          responseCode: "charge_error",
          responseMessage: String(error instanceof Error ? error.message : error).slice(0, 200),
          txnRefNo: newJazzcashPayTxnRef(),
        };
      }

      if (!charge.ok && mockJazzcashChargeAllowed()) {
        usedMock = true;
        charge = {
          ok: true,
          responseCode: "mock",
          responseMessage: charge.responseMessage || "Mock JazzCash charge (staging).",
          txnRefNo: `mock${String(intent.request_id).replace(/\W/g, "").slice(-16)}`.slice(0, 20),
        };
      }

      await databasePool.query(
        `update public.jazzcash_wallet_link_intents
         set payment_token = coalesce(payment_token, $2),
             charge_txn_ref = $3,
             charge_response_code = $4,
             response_message = $5,
             charged_at = case when $6::boolean then now() else charged_at end,
             updated_at = now()
         where request_id = $1`,
        [
          intent.request_id,
          token,
          charge.txnRefNo,
          String(charge.responseCode).slice(0, 40) || null,
          charge.responseMessage || null,
          Boolean(charge.ok),
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
      if (usedMock) {
        // keep going to local grant
      }
    } else if (
      mockJazzcashChargeAllowed()
      && (
        intent.payment_token_present
        || intent.status === "completed"
        || intent.status === "started"
        || intent.status === "returned"
      )
    ) {
      // Staging: JazzCash hosted OTP/MPIN may succeed while merchant return/callback never reaches us.
      // After the learner signs in with the same MSISDN, activate Premium with an auditable mock charge.
      chargeTxnRef = `mock${String(intent.request_id).replace(/\W/g, "").slice(-16)}`.slice(0, 20);
      await databasePool.query(
        `update public.jazzcash_wallet_link_intents
         set status = 'completed',
             payment_token_present = coalesce(payment_token_present, false),
             charge_txn_ref = $2,
             charge_response_code = 'mock',
             response_message = $3,
             completed_at = coalesce(completed_at, now()),
             charged_at = now(),
             updated_at = now()
         where request_id = $1`,
        [intent.request_id, chargeTxnRef, "Mock JazzCash charge after same-number sign-in (staging callback gap)."],
      );
    } else {
      return {
        ok: false,
        status: "failed",
        message: "JazzCash did not return a payment token. Premium was not activated.",
      };
    }
  }

  if (targetUserId && String(intent.user_id) !== String(targetUserId)) {
    await databasePool.query(
      `update public.jazzcash_wallet_link_intents set user_id = $2, updated_at = now() where request_id = $1`,
      [intent.request_id, targetUserId],
    );
    intent = { ...intent, user_id: targetUserId };
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
 * After phone signup/signin/profile load, finish any JazzCash links for this number.
 * Matches by user id or MSISDN so Premium follows the signed-in account, including
 * subscriptions that were granted to a guest checkout user before password sign-in.
 */
export async function reconcileJazzcashPremiumForUser(userId) {
  if (!userId) {
    return { attempted: 0, granted: 0 };
  }

  const userResult = await databasePool.query(
    `select id, "phoneNumber" as phone_number from public."user" where id = $1 limit 1`,
    [userId],
  );
  const phone = userResult.rows[0]?.phone_number;
  const national = phone ? nationalMsisdn(phone) : null;
  const nationalDigits = national ? national.replace(/\D/g, "") : null;
  const e164Digits = phone ? String(phone).replace(/\D/g, "") : null;

  const allowMockClaim = mockJazzcashChargeAllowed();
  const pending = await databasePool.query(
    `select *
     from public.jazzcash_wallet_link_intents
     where (
         user_id = $1
         or (
           $2::text is not null
           and regexp_replace(msisdn, '\\D', '', 'g') in ($2::text, $3::text, $4::text)
         )
       )
       and (
         -- Already activated on guest/other user: move Premium onto this account.
         (subscription_id is not null and user_id is distinct from $1)
         or (
           subscription_id is null
           and (
             status = 'completed'
             or (
               $5::boolean = true
               and status in ('started', 'returned', 'completed', 'failed')
               and created_at > now() - interval '72 hours'
             )
           )
         )
       )
     order by completed_at desc nulls last, created_at desc
     limit 8`,
    [
      userId,
      nationalDigits,
      nationalDigits ? nationalDigits.replace(/^0/, "92") : null,
      e164Digits,
      allowMockClaim,
    ],
  );

  let granted = 0;
  const errors = [];
  for (const intent of pending.rows) {
    try {
      if (intent.subscription_id && String(intent.user_id) !== String(userId)) {
        await transferJazzcashSubscriptionToUser(intent.subscription_id, intent.user_id, userId);
        granted += 1;
        continue;
      }
      if (intent.subscription_id) {
        const linked = await databasePool.query(
          `select status from public.subscriptions where id = $1::uuid limit 1`,
          [intent.subscription_id],
        );
        const linkedStatus = linked.rows[0]?.status;
        // Cancelled/expired linked subscriptions must not count as an active grant,
        // and must not trigger a fresh mock charge for the same intent.
        if (linkedStatus && ["cancelled", "expired"].includes(String(linkedStatus))) {
          continue;
        }
        granted += 1;
        continue;
      }
      const result = await chargeAndGrantJazzcashIntent(intent, intent.payment_token, { userId });
      if (result.ok) granted += 1;
      else {
        errors.push({ requestId: intent.request_id, message: result.message || result.status || "charge_failed" });
        console.warn("jazzcash_premium_reconcile_charge_failed", {
          requestId: intent.request_id,
          status: intent.status,
          message: result.message || result.status,
        });
      }
    } catch (error) {
      // Keep login/profile available; charge can be retried on the next visit.
      errors.push({
        requestId: intent.request_id,
        message: error instanceof Error ? error.message : "reconcile_error",
      });
      console.warn("jazzcash_premium_reconcile_failed", {
        requestId: intent.request_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return {
    attempted: pending.rows.length,
    granted,
    mockChargeAllowed: allowMockClaim,
    phoneMatched: Boolean(nationalDigits),
    errors: errors.slice(0, 3),
  };
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
           'code', $5::text,
           'currency', $6::text,
           'amountMinor', $7::bigint,
           'billingPeriod', $8::text,
           'chargeTxnRef', $9::text
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
        Number(price.amount_minor),
        price.billing_period,
        chargeTxnRef ?? null,
      ],
    );
    const subscriptionId = inserted.rows[0]?.id;
    if (!subscriptionId) throw new Error("subscription_insert_failed");

    const benefits = Array.isArray(price.benefits)
      ? price.benefits.map((value) => String(value))
      : typeof price.benefits === "string"
        ? price.benefits.replace(/[{}]/g, "").split(",").map((value) => value.trim()).filter(Boolean)
        : ["premium_catalogue"];
    if (!benefits.includes("premium_catalogue")) benefits.push("premium_catalogue");

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
      [intent.user_id, subscriptionId, endsAt, benefits],
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
                 'requestId', $3::text,
                 'planCode', $4::text,
                 'chargeTxnRef', $5::text,
                 'msisdn', $6::text
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

/**
 * Server Status Inquiry proxy helper.
 * Resolve txn by charge_txn_ref or by wallet-link request_id → stored charge_txn_ref.
 */
export async function inquireJazzcashLandingStatus({ txnRefNo, requestId } = {}) {
  if (!jazzcashV11Configured()) {
    const error = new Error("jazzcash_unconfigured");
    error.status = 503;
    throw error;
  }

  let resolvedTxnRef = String(txnRefNo ?? "").trim();
  let intent = null;

  if (requestId) {
    const intentResult = await databasePool.query(
      `select request_id, charge_txn_ref, status, subscription_id, response_code, charge_response_code
       from public.jazzcash_wallet_link_intents
       where request_id = $1
       limit 1`,
      [String(requestId).trim()],
    );
    intent = intentResult.rows[0] ?? null;
    if (!intent) {
      const error = new Error("unknown_request");
      error.status = 404;
      throw error;
    }
    if (!resolvedTxnRef) resolvedTxnRef = String(intent.charge_txn_ref ?? "").trim();
  }

  if (!resolvedTxnRef) {
    const error = new Error("missing_txn_ref");
    error.status = 400;
    throw error;
  }

  // Prefer known merchant txn refs so inquiry cannot be used as an open proxy.
  if (!intent) {
    const byCharge = await databasePool.query(
      `select request_id, charge_txn_ref, status, subscription_id, response_code, charge_response_code
       from public.jazzcash_wallet_link_intents
       where charge_txn_ref = $1
       limit 1`,
      [resolvedTxnRef],
    );
    intent = byCharge.rows[0] ?? null;
    if (!intent) {
      const error = new Error("unknown_txn_ref");
      error.status = 404;
      throw error;
    }
  }

  const inquiry = await inquireJazzcashPaymentStatus({ txnRefNo: resolvedTxnRef });
  return {
    ok: inquiry.ok,
    requestId: intent.request_id,
    txnRefNo: inquiry.txnRefNo,
    responseCode: inquiry.responseCode,
    responseMessage: inquiry.responseMessage,
    intentStatus: intent.status,
    subscriptionId: intent.subscription_id ?? null,
    payload: inquiry.payload,
  };
}

/**
 * Delete JazzCash payment token(s) for a user during unsubscribe / wallet unlink.
 * Best-effort against JazzCash; always clears local stored tokens afterward when delete succeeds
 * or when no remote token was present.
 */
export async function unlinkJazzcashWalletForUser(userId) {
  if (!userId) {
    const error = new Error("missing_user");
    error.status = 400;
    throw error;
  }
  if (!jazzcashV11Configured()) {
    return { attempted: 0, deleted: 0, skipped: true, reason: "jazzcash_unconfigured" };
  }

  const intents = await databasePool.query(
    `select request_id, msisdn, payment_token
     from public.jazzcash_wallet_link_intents
     where user_id = $1
       and payment_token is not null
       and length(trim(payment_token)) > 0
     order by updated_at desc nulls last, created_at desc
     limit 5`,
    [userId],
  );

  let deleted = 0;
  const results = [];
  const seenTokens = new Set();

  for (const intent of intents.rows) {
    const token = String(intent.payment_token ?? "").trim();
    if (!token || seenTokens.has(token)) continue;
    seenTokens.add(token);

    try {
      const deletedRemote = await deleteJazzcashPaymentToken({
        paymentToken: token,
        requestId: newJazzcashRequestId(),
      });
      results.push({
        requestId: intent.request_id,
        ok: deletedRemote.ok,
        responseCode: deletedRemote.responseCode,
        responseMessage: deletedRemote.responseMessage,
      });
      if (deletedRemote.ok || deletedRemote.responseCode === "999") {
        deleted += 1;
        // Confirm teardown when we still know the MSISDN.
        const mobile = normalizeJazzcashNationalMsisdn(intent.msisdn);
        if (/^03\d{9}$/.test(mobile)) {
          await inquireJazzcashPaymentToken({ msisdn: mobile }).catch(() => undefined);
        }
      }
    } catch (error) {
      results.push({
        requestId: intent.request_id,
        ok: false,
        error: error instanceof Error ? error.message : String(error),
      });
      console.error("jazzcash_token_delete_failed", {
        userId,
        requestId: intent.request_id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  await databasePool.query(
    `update public.jazzcash_wallet_link_intents
     set payment_token = null,
         payment_token_present = false,
         status = case
           when status in ('started', 'returned', 'completed') then 'failed'
           else status
         end,
         response_code = coalesce(nullif(response_code, ''), 'TOKEN_DELETED'),
         response_message = coalesce(nullif(response_message, ''), 'JazzCash payment token cleared on unlink/unsubscribe'),
         updated_at = now()
     where user_id = $1
       and payment_token is not null`,
    [userId],
  );

  return {
    attempted: seenTokens.size,
    deleted,
    skipped: false,
    results,
  };
}

/**
 * JazzCash IPN / server notify. Same settlement path as Return URL, always ACK-friendly.
 */
export async function handleJazzcashIpn(fields) {
  if (!fields || typeof fields !== "object") {
    return { httpStatus: 400, body: { ok: false, error: "invalid_fields" } };
  }

  const hasPp = Object.keys(fields).some((key) => key.startsWith("pp_"));
  if (!hasPp) {
    return { httpStatus: 400, body: { ok: false, error: "missing_pp_fields" } };
  }

  try {
    const result = await completeJazzcashLandingLink(fields);
    return {
      httpStatus: 200,
      body: {
        ok: result.ok,
        requestId: result.requestId,
        status: result.status,
        message: result.message,
      },
    };
  } catch (error) {
    const code = error instanceof Error ? error.message : "ipn_failed";
    // ACK 200 for known business misses so JazzCash does not storm retries on unknown RequestID;
    // still surface parse/hash failures as 400.
    if (code === "unknown_request" || code === "missing_request_id") {
      console.error("jazzcash_ipn_unknown", code);
      return { httpStatus: 200, body: { ok: false, error: code } };
    }
    if (code === "invalid_hash") {
      console.error("jazzcash_ipn_invalid_hash");
      return { httpStatus: 400, body: { ok: false, error: code } };
    }
    console.error("jazzcash_ipn_failed", code);
    return { httpStatus: 200, body: { ok: false, error: code } };
  }
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

  const hashValid = !fields.pp_SecureHash || !jazzcashV11Configured() || verifyJazzcashSecureHash(fields);
  if (!hashValid && !mockJazzcashChargeAllowed()) {
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
  const paymentToken = extractJazzcashPaymentToken(fields);
  const success = ["000", "121", "200", "0"].includes(responseCode) || Boolean(paymentToken);
  const tokenPresent = Boolean(paymentToken);

  await databasePool.query(
    `update public.jazzcash_wallet_link_intents
     set status = $2,
         payment_token_present = $3::boolean,
         payment_token = case when $3::boolean and $6::text <> '' then $6::text else payment_token end,
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
