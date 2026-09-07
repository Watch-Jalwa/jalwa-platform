"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/database/server";
import { cancelPaymentServiceSubscription, getPaymentServiceStatus, paymentServiceEnabled, unlinkPaymentServiceWallet } from "@/lib/payments/payment-service";
import { validRemoteId } from "@/lib/payments/bff";
import { isFrontendPreview } from "@/lib/runtime";

export async function requestCancellation(formData: FormData) {
  if (isFrontendPreview()) redirect("/billing?preview=1");
  const subscriptionId = String(formData.get("subscriptionId") ?? "");
  const database = await createClient();
  const { data: { user } } = await database.auth.getUser();
  if (!user) redirect("/login?next=/billing");

  if (paymentServiceEnabled()) {
    if (!validRemoteId(subscriptionId)) redirect("/billing?error=cancellation");
    try {
      const status = await getPaymentServiceStatus(user.id);
      if (!status.subscriptions.some((subscription) => subscription.id === subscriptionId)) redirect("/billing?error=cancellation");
      await cancelPaymentServiceSubscription(subscriptionId);
    } catch {
      redirect("/billing?error=cancellation");
    }
    revalidatePath("/billing");
    redirect("/billing?cancelled=1");
  }

  const { error } = await database.rpc("request_subscription_cancellation", { p_subscription_id: subscriptionId });
  if (error) redirect("/billing?error=cancellation");
  revalidatePath("/billing");
  redirect("/billing?cancelled=1");
}

export async function unlinkWallet() {
  if (isFrontendPreview()) redirect("/billing?preview=1");
  const database = await createClient();
  const { data: { user } } = await database.auth.getUser();
  if (!user) redirect("/login?next=/billing");
  if (!paymentServiceEnabled()) redirect("/billing?error=wallet");
  try {
    await unlinkPaymentServiceWallet(user.id);
  } catch {
    redirect("/billing?error=wallet");
  }
  revalidatePath("/billing");
  redirect("/billing?unlinked=1");
}
