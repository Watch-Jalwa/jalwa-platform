"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getActiveViewerProfile } from "@/lib/customer/active-profile";
import { createClient } from "@/lib/supabase/server";
import { isFrontendPreview } from "@/lib/runtime";

export async function clearWatchHistory() {
  if (isFrontendPreview()) redirect("/history?preview=1");
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/history");
  const profile = await getActiveViewerProfile(user.id);
  if (profile) await supabase.from("watch_progress").delete().eq("user_id", user.id).eq("viewer_profile_id", profile.id);
  revalidatePath("/history");
}
