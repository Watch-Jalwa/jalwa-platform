import { databasePool } from "@/lib/database/pool";
import { unlinkJazzcashWalletForUser } from "./jazzcash-landing-billing.mjs";
import { e164FromMsisdn, nationalMsisdn } from "./phone-checkout-user.mjs";
import {
  cancelPaymentServiceSubscription,
  getPaymentServiceStatus,
  paymentServiceEnabled,
} from "./payment-service";

function maskMsisdn(national) {
  const digits = String(national ?? "");
  if (digits.length < 7) return digits;
  return `${digits.slice(0, 3)}****${digits.slice(-4)}`;
}

async function resolveUserIdByMsisdn(msisdn) {
  const national = nationalMsisdn(msisdn);
  const e164 = e164FromMsisdn(national);
  if (!e164 || !/^03\d{9}$/.test(national)) {
    const error = new Error("invalid_msisdn");
    error.status = 400;
    throw error;
  }

  const byPhone = await databasePool.query(
    `select id::text as id
     from public."user"
     where "phoneNumber" = $1
        or "phoneNumber" = $2
     limit 1`,
    [e164, national],
  );
  if (byPhone.rows[0]?.id) {
    return { userId: byPhone.rows[0].id, national, e164 };
  }

  // Pay-first JazzCash intents may bind Premium before the Better Auth phone field is set.
  const byIntent = await databasePool.query(
    `select user_id::text as id
     from public.jazzcash_wallet_link_intents
     where msisdn = $1
        or msisdn = $2
     order by updated_at desc nulls last, created_at desc
     limit 1`,
    [national, e164],
  );
  if (byIntent.rows[0]?.id) {
    return { userId: byIntent.rows[0].id, national, e164 };
  }

  return { userId: null, national, e164 };
}

async function loadActivePremiumSummary(userId) {
  const sub = await databasePool.query(
    `select s.id::text as id,
            s.status::text as status,
            coalesce(p.name, 'Jalwa Premium') as plan_name
     from public.subscriptions s
     left join public.plans p on p.id = s.plan_id
     where s.user_id = $1
       and s.status in ('active', 'past_due', 'cancel_at_period_end', 'incomplete')
     order by s.updated_at desc nulls last
     limit 1`,
    [userId],
  );
  if (sub.rows[0]) {
    return {
      hasSubscription: true,
      planName: String(sub.rows[0].plan_name),
      subscriptionId: sub.rows[0].id,
    };
  }

  const entitlement = await databasePool.query(
    `select id::text as id
     from public.entitlements
     where user_id = $1
       and status = 'active'
       and benefit_code = 'premium_catalogue'
       and (ends_at is null or ends_at > now())
     limit 1`,
    [userId],
  );
  if (entitlement.rows[0]) {
    return {
      hasSubscription: true,
      planName: "Jalwa Premium",
      subscriptionId: null,
    };
  }

  return { hasSubscription: false, planName: null, subscriptionId: null };
}

/**
 * Look up whether a JazzCash mobile number has Premium on Jalwa.
 * Public header Unsubscribe step 1 — no session required.
 */
export async function lookupPremiumByJazzcashMsisdn(msisdn) {
  const resolved = await resolveUserIdByMsisdn(msisdn);
  if (!resolved.userId) {
    return {
      ok: true,
      hasSubscription: false,
      msisdnMasked: maskMsisdn(resolved.national),
      message: "No Jalwa Premium subscription was found for this JazzCash number.",
    };
  }

  const premium = await loadActivePremiumSummary(resolved.userId);
  if (!premium.hasSubscription) {
    return {
      ok: true,
      hasSubscription: false,
      msisdnMasked: maskMsisdn(resolved.national),
      message: "No Jalwa Premium subscription was found for this JazzCash number.",
    };
  }

  return {
    ok: true,
    hasSubscription: true,
    msisdnMasked: maskMsisdn(resolved.national),
    planName: premium.planName,
    message: `Active ${premium.planName} found for ${maskMsisdn(resolved.national)}.`,
  };
}

/**
 * Cancel Premium for the account bound to a JazzCash mobile number.
 * Public header Unsubscribe step 2 (after explicit confirm) — no session required.
 */
export async function unsubscribePremiumByJazzcashMsisdn(msisdn, { source = "header" } = {}) {
  const resolved = await resolveUserIdByMsisdn(msisdn);
  if (!resolved.userId) {
    return {
      ok: false,
      error: "no_subscription",
      message: "No Jalwa Premium subscription was found for this JazzCash number.",
    };
  }

  const premium = await loadActivePremiumSummary(resolved.userId);
  if (!premium.hasSubscription) {
    return {
      ok: false,
      error: "no_subscription",
      message: "No Jalwa Premium subscription was found for this JazzCash number.",
    };
  }

  const stopped = await stopPremiumForUser(resolved.userId, { source, msisdn: resolved.national });
  if (!stopped.ok) return stopped;

  return {
    ok: true,
    msisdnMasked: maskMsisdn(resolved.national),
    message: "Premium access has been stopped for this JazzCash number. Your plan is now Free.",
  };
}

/**
 * Shared Premium teardown used by signed-in profile Unsubscribe and public MSISDN Unsubscribe.
 */
export async function stopPremiumForUser(userId, { source = "profile", msisdn = null } = {}) {
  if (!userId) {
    return { ok: false, message: "Missing user." };
  }

  if (paymentServiceEnabled()) {
    try {
      const status = await getPaymentServiceStatus(userId);
      for (const subscription of status.subscriptions ?? []) {
        if (["initiated", "trialing", "active", "past_due", "paused"].includes(subscription.status)) {
          await cancelPaymentServiceSubscription(subscription.id);
        }
      }
    } catch {
      // Continue local revoke even if remote cancel fails.
    }
  }

  try {
    await unlinkJazzcashWalletForUser(userId);
  } catch (unlinkError) {
    console.warn("premium_unsubscribe_jazzcash_token_delete_failed", {
      userId,
      source,
      error: unlinkError instanceof Error ? unlinkError.message : String(unlinkError),
    });
  }

  try {
    await databasePool.query(
      `update public.subscriptions
       set status = 'cancelled'::public.subscription_status,
           cancel_at_period_end = false,
           auto_renew_consented = false,
           current_period_end = least(coalesce(current_period_end, now()), now()),
           cancellation_requested_at = coalesce(cancellation_requested_at, now()),
           cancelled_at = coalesce(cancelled_at, now()),
           updated_at = now()
       where user_id = $1
         and status in ('active', 'past_due', 'cancel_at_period_end', 'incomplete')`,
      [userId],
    );

    await databasePool.query(
      `update public.entitlements
       set status = 'revoked'::public.entitlement_status,
           ends_at = least(ends_at, now()),
           updated_at = now()
       where user_id = $1
         and status = 'active'`,
      [userId],
    );

    try {
      await databasePool.query(
        `update public.jazzcash_wallet_link_intents
         set status = 'failed',
             response_code = coalesce(nullif(response_code, ''), 'USER_UNSUBSCRIBED'),
             response_message = coalesce(nullif(response_message, ''), 'User unsubscribed'),
             updated_at = now()
         where user_id = $1
           and status in ('started', 'returned')
           and created_at > now() - interval '72 hours'`,
        [userId],
      );
    } catch (intentError) {
      console.warn("premium_unsubscribe_intent_mark_failed", {
        userId,
        error: intentError instanceof Error ? intentError.message : String(intentError),
      });
    }

    try {
      await databasePool.query(
        `insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
         values ($1, 'premium_unsubscribed_immediate', 'user', $1::text, $2::jsonb)`,
        [
          userId,
          JSON.stringify({
            source,
            msisdnMasked: msisdn ? maskMsisdn(msisdn) : null,
          }),
        ],
      );
    } catch (auditError) {
      console.warn("premium_unsubscribe_audit_failed", {
        userId,
        error: auditError instanceof Error ? auditError.message : String(auditError),
      });
    }
  } catch (error) {
    console.error("premium_unsubscribe_failed", {
      userId,
      source,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not stop Premium right now.",
    };
  }

  return { ok: true };
}
