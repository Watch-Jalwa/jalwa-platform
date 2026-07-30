"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/studio/auth";

const statuses = new Set(["open", "in_progress", "waiting", "resolved", "closed"]);

export async function updateSupportCase(formData: FormData) {
  const { profile, user } = await requireStaff();
  if (profile.role !== "support" && profile.role !== "admin") redirect("/studio");

  const id = String(formData.get("id") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id || !statuses.has(status)) return;

  const admin = createAdminClient();
  const { error } = await admin.from("support_cases").update({ status }).eq("id", id);
  if (!error) {
    await admin.from("audit_logs").insert({
      actor_id: user.id,
      action: "support_case.status_updated",
      entity_type: "support_case",
      entity_id: id,
      metadata: { status },
    });
  }
  revalidatePath("/studio/support");
}
