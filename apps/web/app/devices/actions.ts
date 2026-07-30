"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isFrontendPreview } from "@/lib/runtime";

export async function revokeDevice(formData: FormData) {
  if (isFrontendPreview()) redirect("/devices?preview=1");
  const deviceId = String(formData.get("deviceId") ?? "");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/devices");
  await supabase.from("user_devices").update({ revoked_at: new Date().toISOString() }).eq("id", deviceId).eq("user_id", user.id);
  revalidatePath("/devices");
}
