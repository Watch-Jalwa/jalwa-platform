import { createHash } from "node:crypto";
import { databasePool } from "@/lib/database/pool";
import {
  getPaymentServicePlans,
  getPaymentServiceStatus,
  type PaymentServicePlan,
  type PaymentServiceStatus,
  type PaymentServiceSubscription,
} from "@/lib/payments/payment-service";

export const PAYMENT_SERVICE_EVENT_TYPES = new Set([
  "wallet.linked",
  "wallet.unlinked",
  "subscription.created",
  "subscription.activated",
  "subscription.renewed",
  "subscription.past_due",
  "subscription.payment_failed",
  "subscription.expired",
  "subscription.canceled",
  "payment.pending",
  "payment.completed",
  "payment.failed",
  "payment.refunded",
]);

export type ProductPaymentEvent = {
  eventId: string;
  type: string;
  userId: string;
  createdAt: string;
  data: Record<string, unknown>;
};

function relevantSubscription(status: PaymentServiceStatus, event: ProductPaymentEvent) {
  const hintedId = typeof event.data.subscriptionId === "string" ? event.data.subscriptionId : null;
  if (hintedId) {
    const hinted = status.subscriptions.find((subscription) => subscription.id === hintedId);
    if (hinted) return hinted;
  }
  const open = status.subscriptions.find((subscription) => ["initiated", "trialing", "active", "past_due", "paused"].includes(subscription.status));
  if (open) return open;
  if (event.type === "subscription.canceled" || event.type === "wallet.unlinked") {
    return [...status.subscriptions]
      .filter((subscription) => subscription.status === "canceled")
      .sort((left, right) => Date.parse(right.current_period_end ?? "") - Date.parse(left.current_period_end ?? ""))[0] ?? null;
  }
  return status.subscriptions[0] ?? null;
}

function validateSubscriptionAgainstCatalog(subscription: PaymentServiceSubscription, plans: PaymentServicePlan[]) {
  const plan = plans.find((item) => item.code === subscription.plan_code);
  if (!plan) throw new Error("payment service subscription plan is not in the authoritative catalog");
  if (
    plan.currency !== subscription.currency ||
    plan.interval !== subscription.interval ||
    plan.fullAmountMinor !== subscription.amount_minor ||
    plan.stepAmountMinor !== subscription.step_amount_minor
  ) throw new Error("payment service subscription does not match the authoritative plan catalog");
  return plan;
}

function localStatus(remote: PaymentServiceSubscription["status"]) {
  switch (remote) {
    case "initiated": return "incomplete";
    case "trialing":
    case "active": return "active";
    case "past_due":
    case "paused": return "past_due";
    case "canceled": return "cancelled";
    case "payment_failed":
    case "expired": return "expired";
  }
}

function accessEnd(status: PaymentServiceStatus, subscription: PaymentServiceSubscription) {
  const now = Date.now();
  if (subscription.status === "trialing" && subscription.trial_ends_at && Date.parse(subscription.trial_ends_at) > now) {
    return subscription.trial_ends_at;
  }
  if (["active", "past_due", "paused", "canceled"].includes(subscription.status) && status.status.current_period_paid && subscription.current_period_end && Date.parse(subscription.current_period_end) > now) {
    return subscription.current_period_end;
  }
  return null;
}

async function existingEvent(eventId: string) {
  const result = await databasePool.query<{ payload_hash: string; status: string }>(
    "select payload_hash,status from public.webhook_events where provider='jazzcash' and provider_event_id=$1",
    [eventId],
  );
  return result.rows[0] ?? null;
}

export async function reconcilePaymentServiceEvent(rawBody: string, event: ProductPaymentEvent) {
  const payloadHash = createHash("sha256").update(rawBody).digest("hex");
  const prior = await existingEvent(event.eventId);
  if (prior) {
    if (prior.payload_hash !== payloadHash) return { ok: false as const, status: 409, error: "Conflicting payment event replay." };
    return { ok: true as const, idempotent: true, reconciled: prior.status === "processed" };
  }

  let status: PaymentServiceStatus;
  let plans: PaymentServicePlan[];
  try {
    [status, plans] = await Promise.all([getPaymentServiceStatus(event.userId), getPaymentServicePlans()]);
  } catch (error) {
    return { ok: false as const, status: 503, error: error instanceof Error ? error.message : "Authoritative payment state is unavailable." };
  }

  const subscription = relevantSubscription(status, event);
  if (subscription) {
    try { validateSubscriptionAgainstCatalog(subscription, plans); }
    catch (error) { return { ok: false as const, status: 400, error: error instanceof Error ? error.message : "Payment plan validation failed." }; }
  }

  const client = await databasePool.connect();
  try {
    await client.query("begin");
    await client.query("select pg_advisory_xact_lock(hashtextextended($1,0))", [`payment-service:${event.eventId}`]);
    const raced = await client.query<{ payload_hash: string; status: string }>(
      "select payload_hash,status from public.webhook_events where provider='jazzcash' and provider_event_id=$1",
      [event.eventId],
    );
    if (raced.rows[0]) {
      if (raced.rows[0].payload_hash !== payloadHash) {
        await client.query("rollback");
        return { ok: false as const, status: 409, error: "Conflicting payment event replay." };
      }
      await client.query("commit");
      return { ok: true as const, idempotent: true, reconciled: raced.rows[0].status === "processed" };
    }

    const userResult = await client.query<{ id: string }>("select id::text as id from public.profiles where id=$1", [event.userId]);
    if (userResult.rowCount !== 1) {
      await client.query("rollback");
      return { ok: false as const, status: 404, error: "Payment user is not a Jalwa account." };
    }

    await client.query(
      `insert into public.webhook_events(provider,provider_event_id,signature_valid,payload_hash,status)
       values('jazzcash',$1,true,$2,'received')`,
      [event.eventId, payloadHash],
    );

    let localSubscriptionId: string | null = null;
    let grantedUntil: string | null = null;
    if (subscription) {
      const planResult = await client.query<{ id: string; benefits: string[] }>(
        "select id::text as id,benefits from public.plans where code='premium' and is_active=true limit 1",
      );
      const localPlan = planResult.rows[0];
      if (!localPlan) throw new Error("Jalwa Premium plan is unavailable.");

      const existingSubscription = await client.query<{ id: string }>(
        "select id::text as id from public.subscriptions where provider='jazzcash' and provider_subscription_id=$1 order by created_at desc limit 1 for update",
        [subscription.id],
      );
      const mappedStatus = localStatus(subscription.status);
      const periodEnd = subscription.current_period_end ?? subscription.trial_ends_at ?? null;
      if (existingSubscription.rows[0]) {
        localSubscriptionId = existingSubscription.rows[0].id;
        await client.query(
          `update public.subscriptions
           set plan_id=$2,provider='jazzcash',provider_subscription_id=$3,status=$4::public.subscription_status,
               current_period_start=coalesce(current_period_start,case when $4 in ('active','past_due') then now() else null end),
               current_period_end=$5::timestamptz,cancel_at_period_end=false,updated_at=now()
           where id=$1`,
          [localSubscriptionId, localPlan.id, subscription.id, mappedStatus, periodEnd],
        );
      } else {
        const inserted = await client.query<{ id: string }>(
          `insert into public.subscriptions(user_id,plan_id,provider,provider_subscription_id,status,current_period_start,current_period_end,cancel_at_period_end)
           values($1,$2,'jazzcash',$3,$4::public.subscription_status,case when $4 in ('active','past_due') then now() else null end,$5::timestamptz,false)
           returning id::text as id`,
          [event.userId, localPlan.id, subscription.id, mappedStatus, periodEnd],
        );
        const insertedSubscription = inserted.rows[0];
        if (!insertedSubscription) throw new Error("Jalwa subscription projection failed.");
        localSubscriptionId = insertedSubscription.id;
      }

      grantedUntil = accessEnd(status, subscription);
      if (grantedUntil) {
        await client.query(
          `insert into public.entitlements(user_id,benefit_code,starts_at,ends_at,source_type,source_id,status)
           select $1,benefit,now(),$3::timestamptz,'subscription',$2::uuid,'active'::public.entitlement_status
           from unnest($4::text[]) benefit
           on conflict(user_id,benefit_code,source_type,source_id)
           do update set starts_at=least(public.entitlements.starts_at,excluded.starts_at),ends_at=excluded.ends_at,status='active',updated_at=now()`,
          [event.userId, localSubscriptionId, grantedUntil, localPlan.benefits],
        );
      } else {
        await client.query(
          `update public.entitlements set status='revoked',ends_at=least(ends_at,now()),updated_at=now()
           where source_type='subscription' and source_id=$1::uuid and status in ('active','scheduled')`,
          [localSubscriptionId],
        );
      }
    }

    await client.query(
      `update public.webhook_events set status='processed',processed_at=now(),error_message=null
       where provider='jazzcash' and provider_event_id=$1`,
      [event.eventId],
    );
    await client.query(
      `insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
       values(null,'payment_service_reconciled','payment_service_event',$1,
       jsonb_build_object('event_type',$2,'user_id',$3,'remote_subscription_id',$4,'remote_status',$5,'plan_code',$6,'charge_tier',$7,'entitled_until',$8,'event_created_at',$9))`,
      [
        event.eventId,
        event.type,
        event.userId,
        subscription?.id ?? null,
        subscription?.status ?? status.status.subscription_status,
        subscription?.plan_code ?? null,
        subscription?.charge_tier ?? null,
        grantedUntil,
        event.createdAt,
      ],
    );
    await client.query("commit");
    return { ok: true as const, idempotent: false, reconciled: true, subscriptionStatus: subscription?.status ?? null, entitledUntil: grantedUntil };
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    console.warn("payment_service_webhook_reconcile_failed", { eventId: event.eventId, eventType: event.type, error: error instanceof Error ? error.message : "unknown" });
    return { ok: false as const, status: 500, error: "Payment event could not be reconciled." };
  } finally {
    client.release();
  }
}
