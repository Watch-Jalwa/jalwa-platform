"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_PROFILE_COOKIE } from "@/lib/customer/active-profile";
import { localeCookieOptions, LOCALE_COOKIE, normalizeLocale } from "@/lib/customer/locale";
import { createClient } from "@/lib/supabase/server";
import { isFrontendPreview } from "@/lib/runtime";

const languages = new Set(["en", "ur", "roman_ur"]);

export async function completeOnboarding(formData: FormData) {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const viewerName = String(formData.get("viewerName") ?? displayName).trim();
  const preferredLanguageInput = String(formData.get("preferredLanguage") ?? "en");
  const preferredLanguage = normalizeLocale(preferredLanguageInput);
  const plan = String(formData.get("plan") ?? "free");
  const accepted = formData.get("acceptedTerms") === "on";
  const marketingOptIn = formData.get("marketingOptIn") === "on";

  if (displayName.length < 2 || viewerName.length < 1 || !languages.has(preferredLanguageInput) || !accepted) {
    redirect(`/onboarding?error=invalid&plan=${encodeURIComponent(plan)}`);
  }
  if (isFrontendPreview()) redirect(plan === "free" ? "/profile?onboarding=preview" : `/pricing?selected=${encodeURIComponent(plan)}`);

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/onboarding?plan=${plan}`)}`);

  const { error: profileError } = await supabase.from("profiles").update({
    display_name: displayName,
    preferred_language: preferredLanguage,
    accepted_terms_at: new Date().toISOString(),
    marketing_opt_in: marketingOptIn,
    onboarding_completed: true,
  }).eq("id", user.id);
  if (profileError) redirect(`/onboarding?error=save&plan=${encodeURIComponent(plan)}`);

  const { data: viewer } = await supabase.from("viewer_profiles")
    .update({ name: viewerName, preferred_language: preferredLanguage })
    .eq("user_id", user.id).eq("is_default", true).select("id").maybeSingle();
  const cookieStore = await cookies();
  cookieStore.set(LOCALE_COOKIE, preferredLanguage, localeCookieOptions());
  if (viewer?.id) cookieStore.set(ACTIVE_PROFILE_COOKIE, viewer.id, localeCookieOptions());

  redirect(plan === "free" ? "/profile?onboarding=complete" : `/pricing?selected=${encodeURIComponent(plan)}`);
}
