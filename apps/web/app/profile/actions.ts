"use server";

import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

async function authenticatedUser() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile");
  return { supabase, user };
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
  const { supabase } = await authenticatedUser();
  const { error } = await supabase.rpc("cancel_account_deletion", { p_request_id: requestId });
  if (error) redirect("/profile?request=deletion-cancel-failed");
  redirect("/profile?request=deletion-cancelled");
}

export async function signOut() {
  const { supabase } = await authenticatedUser();
  await supabase.auth.signOut();
  redirect("/");
}
