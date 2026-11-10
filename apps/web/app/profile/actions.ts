"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/database/admin";
import { createClient } from "@/lib/database/server";
import { stopPremiumForUser } from "@/lib/payments/unsubscribe-by-msisdn.mjs";

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
  const result = await stopPremiumForUser(user.id, { source: "profile" });
  if (!result.ok) {
    return { ok: false, message: result.message || "Could not stop Premium right now." };
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
