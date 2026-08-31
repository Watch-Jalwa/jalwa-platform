"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/database/server";
import { isFrontendPreview } from "@/lib/runtime";

export async function revokeDevice(formData: FormData) {
  if (isFrontendPreview()) redirect("/devices?preview=1");
  const deviceId = String(formData.get("deviceId") ?? "");
  const database = await createClient();
  const { data: { user } } = await database.auth.getUser();
  if (!user) redirect("/login?next=/devices");
  const { error } = await database.rpc("revoke_device", { p_device_id: deviceId });
  if (error) redirect("/devices?error=revoke");
  revalidatePath("/devices");
}
