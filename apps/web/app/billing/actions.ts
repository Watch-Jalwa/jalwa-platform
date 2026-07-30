"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isFrontendPreview } from "@/lib/runtime";

export async function requestCancellation(formData: FormData) {
  if (isFrontendPreview()) redirect("/billing?preview=1");
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/billing");
  const { error } = await supabase.rpc("request_subscription_cancellation", { p_subscription_id: subscriptionId });
  if (error) redirect("/billing?error=cancellation");
  revalidatePath("/billing");
  redirect("/billing?cancelled=1");
}
