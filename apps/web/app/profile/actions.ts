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
  const { error } = await admin.from("account_requests").insert({ user_id: user.id, request_type: requestType });
  if (error && error.code !== "23505") redirect(`/profile?request=${requestType}-failed`);
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

export async function signOut() {
  const { supabase } = await authenticatedUser();
  await supabase.auth.signOut();
  redirect("/");
}
