"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/studio/auth";

export async function resolvePaymentException(formData: FormData) {
  const { supabase, profile } = await requireStaff();
  if (profile.role !== "finance" && profile.role !== "admin") redirect("/studio");
  const caseId = String(formData.get("caseId") ?? "");
  const resolution = String(formData.get("resolution") ?? "resolved");
  const note = String(formData.get("note") ?? "").trim();
  if (!caseId || !["resolved", "dismissed"].includes(resolution) || note.length < 3) redirect("/studio/finance?error=resolution");
  const { data, error } = await supabase.rpc("resolve_payment_exception", {
    p_case_id: caseId,
    p_resolution: resolution,
    p_note: note,
  });
  if (error || !data) redirect("/studio/finance?error=save");
  revalidatePath("/studio/finance");
  redirect("/studio/finance?updated=1");
}
