"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/database/admin";
import { createClient } from "@/lib/database/server";
import { databasePool } from "@/lib/database/pool";
import {
  cancelPaymentServiceSubscription,
  getPaymentServiceStatus,
  paymentServiceEnabled,
} from "@/lib/payments/payment-service";
import { unlinkJazzcashWalletForUser } from "@/lib/payments/jazzcash-landing-billing.mjs";

async function authenticatedUser() {
  const database = await createClient();
  const { data: { user } } = await database.auth.getUser();
  if (!user) redirect("/login?next=/profile");
  return { database, user };
}

async function createAccountRequest(requestType: "export" | "deletion") {
  const { user } = await authenticatedUser();
  const admin = createAdminClient();
  const { data: existing } = await admin.from("account_requests")
    .select("id,status")
    .eq("user_id", user.id)
    .eq("request_type", requestType)
    .in("status", ["requested", "in_review", "processing", "failed"])
    .order("requested_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (existing?.status === "failed") {
    const { error } = await admin.from("account_requests").update({
      status: "requested",
      processing_attempts: 0,
      available_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
      error_message: null,
    }).eq("id", existing.id);
    if (error) redirect(`/profile?request=${requestType}-failed`);
    redirect(`/profile?request=${requestType}-received`);
  }
  if (existing) redirect(`/profile?request=${requestType}-received`);
  const { error } = await admin.from("account_requests").insert({ user_id: user.id, request_type: requestType });
  if (error) redirect(`/profile?request=${requestType}-failed`);
  redirect(`/profile?request=${requestType}-received`);
}

export async function requestAccountExport() {
  await createAccountRequest("export");
}

export async function requestAccountDeletion(formData: FormData) {
  if (String(formData.get("confirmation") ?? "").trim().toUpperCase() !== "DELETE") {
    redirect("/profile?request=deletion-confirmation");
  }
  await createAccountRequest("deletion");
}

export async function cancelAccountDeletion(formData: FormData) {
  const requestId = String(formData.get("requestId") ?? "");
  const { database } = await authenticatedUser();
  const { error } = await database.rpc("cancel_account_deletion", { p_request_id: requestId });
  if (error) redirect("/profile?request=deletion-cancel-failed");
  redirect("/profile?request=deletion-cancelled");
}

/** Immediately stop Premium: cancel open subscriptions and revoke active entitlements now. */
export async function unsubscribePremium(): Promise<{ ok: true } | { ok: false; message: string }> {
  const { user } = await authenticatedUser();

  if (paymentServiceEnabled()) {
    try {
      const status = await getPaymentServiceStatus(user.id);
      for (const subscription of status.subscriptions ?? []) {
        if (["initiated", "trialing", "active", "past_due", "paused"].includes(subscription.status)) {
          await cancelPaymentServiceSubscription(subscription.id);
        }
      }
    } catch {
      // Still revoke local entitlements below so access stops even if the remote cancel fails.
    }
  }

  // Clear JazzCash payment token so recurring debit cannot continue after unsubscribe.
  try {
    await unlinkJazzcashWalletForUser(user.id);
  } catch (unlinkError) {
    console.warn("premium_unsubscribe_jazzcash_token_delete_failed", {
      userId: user.id,
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
      [user.id],
    );

    await databasePool.query(
      `update public.entitlements
       set status = 'revoked'::public.entitlement_status,
           ends_at = least(ends_at, now()),
           updated_at = now()
       where user_id = $1
         and status = 'active'`,
      [user.id],
    );

    // Stop staging mock reconcile from instantly re-granting open JazzCash intents after unsubscribe.
    try {
      await databasePool.query(
        `update public.jazzcash_wallet_link_intents
         set status = 'failed',
             response_code = coalesce(nullif(response_code, ''), 'USER_UNSUBSCRIBED'),
             response_message = coalesce(nullif(response_message, ''), 'User unsubscribed from profile'),
             updated_at = now()
         where user_id = $1
           and status in ('started', 'returned')
           and created_at > now() - interval '72 hours'`,
        [user.id],
      );
    } catch (intentError) {
      console.warn("premium_unsubscribe_intent_mark_failed", {
        userId: user.id,
        error: intentError instanceof Error ? intentError.message : String(intentError),
      });
    }

    try {
      await databasePool.query(
        `insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
         values ($1, 'premium_unsubscribed_immediate', 'user', $1::text, jsonb_build_object('source', 'profile'))`,
        [user.id],
      );
    } catch (auditError) {
      console.warn("premium_unsubscribe_audit_failed", {
        userId: user.id,
        error: auditError instanceof Error ? auditError.message : String(auditError),
      });
    }
  } catch (error) {
    console.error("premium_unsubscribe_failed", {
      userId: user.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not stop Premium right now.",
    };
  }

  revalidatePath("/profile");
  revalidatePath("/billing");
  revalidatePath("/premium");
  revalidatePath("/explore");
  revalidatePath("/");
  return { ok: true };
}

export async function signOut() {
  const database = await createClient();
  await database.auth.signOut();
  revalidatePath("/");
  revalidatePath("/profile");
  redirect("/");
}
