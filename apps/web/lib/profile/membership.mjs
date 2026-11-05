import { databasePool } from "@/lib/database/pool";

/**
 * Resolve the signed-in user's current plan label for the profile page.
 */
export async function getUserMembership(userId) {
  const subscription = await databasePool.query(
    `select s.id, s.status, s.current_period_end, p.name as plan_name, p.code as plan_code
     from public.subscriptions s
     left join public.plans p on p.id = s.plan_id
     where s.user_id = $1
     order by
       case s.status
         when 'active' then 0
         when 'past_due' then 1
         when 'cancel_at_period_end' then 2
         else 3
       end,
       s.created_at desc
     limit 1`,
    [userId],
  );

  const entitlement = await databasePool.query(
    `select ends_at
     from public.entitlements
     where user_id = $1
       and benefit_code = 'premium_catalogue'
       and status = 'active'
       and starts_at <= now()
       and ends_at > now()
     order by ends_at desc
     limit 1`,
    [userId],
  );

  const sub = subscription.rows[0] ?? null;
  const premiumActive = Boolean(entitlement.rows[0]);
  const subActive = sub && ["active", "past_due", "cancel_at_period_end"].includes(sub.status);

  if (subActive || premiumActive) {
    return {
      planName: sub?.plan_name || "Jalwa Premium",
      planCode: sub?.plan_code || "premium",
      status: subActive ? sub.status : "active",
      currentPeriodEnd: sub?.current_period_end || entitlement.rows[0]?.ends_at || null,
      canUnsubscribe: true,
      subscriptionId: sub?.id ?? null,
    };
  }

  return {
    planName: "Free",
    planCode: "free",
    status: "free",
    currentPeriodEnd: null,
    canUnsubscribe: false,
    subscriptionId: null,
  };
}
