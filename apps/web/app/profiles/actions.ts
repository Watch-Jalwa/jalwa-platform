"use server";

import { cookies } from "next/headers";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ACTIVE_PROFILE_COOKIE } from "@/lib/customer/active-profile";
import { localeCookieOptions, LOCALE_COOKIE, normalizeLocale } from "@/lib/customer/locale";
import { createClient } from "@/lib/supabase/server";
import { isFrontendPreview } from "@/lib/runtime";

async function userContext() {
  if (isFrontendPreview()) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profiles");
  return { supabase, user };
}

export async function createViewerProfile(formData: FormData) {
  const context = await userContext();
  if (!context) redirect("/profiles?preview=1");
  const name = String(formData.get("name") ?? "").trim();
  const profileType = String(formData.get("profileType") ?? "adult");
  const avatarKey = String(formData.get("avatarKey") ?? "spark");
  const preferredLanguage = normalizeLocale(String(formData.get("preferredLanguage") ?? "en"));
  if (!name || name.length > 40) redirect("/profiles?error=name");
  const { error } = await context.supabase.from("viewer_profiles").insert({ user_id: context.user.id, name, profile_type: profileType, avatar_key: avatarKey, preferred_language: preferredLanguage, kids_mode: profileType === "child" });
  if (error) redirect(`/profiles?error=${error.message.includes("five") ? "limit" : "save"}`);
  revalidatePath("/profiles");
  redirect("/profiles?created=1");
}

export async function selectViewerProfile(formData: FormData) {
  const context = await userContext();
  if (!context) redirect("/profiles?preview=1");
  const profileId = String(formData.get("profileId") ?? "");
  const { data } = await context.supabase.from("viewer_profiles").select("id,preferred_language").eq("id", profileId).eq("user_id", context.user.id).maybeSingle();
  if (!data) redirect("/profiles?error=missing");
  const cookieStore = await cookies();
  cookieStore.set(ACTIVE_PROFILE_COOKIE, profileId, localeCookieOptions());
  cookieStore.set(LOCALE_COOKIE, normalizeLocale(data.preferred_language), localeCookieOptions());
  redirect("/profiles?selected=1");
}

export async function deleteViewerProfile(formData: FormData) {
  const context = await userContext();
  if (!context) redirect("/profiles?preview=1");
  const profileId = String(formData.get("profileId") ?? "");
  const { error } = await context.supabase.from("viewer_profiles").delete().eq("id", profileId).eq("user_id", context.user.id).eq("is_default", false);
  if (error) redirect("/profiles?error=delete");
  const cookieStore = await cookies();
  if (cookieStore.get(ACTIVE_PROFILE_COOKIE)?.value === profileId) {
    cookieStore.delete(ACTIVE_PROFILE_COOKIE);
    cookieStore.delete(LOCALE_COOKIE);
  }
  revalidatePath("/profiles");
}
