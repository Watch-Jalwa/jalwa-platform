import { cookies } from "next/headers";
import { createClient } from "@/lib/database/server";

export const ACTIVE_PROFILE_COOKIE = "jalwa_viewer_profile";

export async function getActiveViewerProfile(userId: string) {
  const database = await createClient();
  const cookieStore = await cookies();
  const requestedId = cookieStore.get(ACTIVE_PROFILE_COOKIE)?.value;

  if (requestedId) {
    const { data } = await database.from("viewer_profiles")
      .select("id,name,profile_type,avatar_key,preferred_language,kids_mode,is_default")
      .eq("id", requestedId).eq("user_id", userId).maybeSingle();
    if (data) return data;
  }

  const { data } = await database.from("viewer_profiles")
    .select("id,name,profile_type,avatar_key,preferred_language,kids_mode,is_default")
    .eq("user_id", userId).order("is_default", { ascending: false }).order("created_at").limit(1).maybeSingle();
  return data;
}
