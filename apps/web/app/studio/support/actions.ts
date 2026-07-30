"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/studio/auth";

const statuses = new Set(["open", "in_progress", "waiting", "resolved", "closed"]);

export async function updateSupportCase(formData: FormData) {
  const { profile } = await requireStaff();
  if (profile.role !== "support" && profile.role !== "admin") redirect("/studio");

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !statuses.has(status)) return;

  const admin = createAdminClient();
  await admin.from("support_cases").update({ status }).eq("id", id);
  revalidatePath("/studio/support");
}
