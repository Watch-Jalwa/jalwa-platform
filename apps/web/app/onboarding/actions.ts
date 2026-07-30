"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ACTIVE_PROFILE_COOKIE } from "@/lib/customer/active-profile";
import { createClient } from "@/lib/supabase/server";
import { isFrontendPreview } from "@/lib/runtime";

const languages = new Set(["en", "ur", "roman_ur"]);

export async function completeOnboarding(formData: FormData) {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const viewerName = String(formData.get("viewerName") ?? displayName).trim();
  const preferredLanguage = String(formData.get("preferredLanguage") ?? "en");
  const plan = String(formData.get("plan") ?? "free");
  const accepted = formData.get("acceptedTerms") === "on";
  const marketingOptIn = formData.get("marketingOptIn") === "on";

  if (displayName.length < 2 || viewerName.length < 1 || !languages.has(preferredLanguage) || !accepted) {
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
  if (viewer?.id) (await cookies()).set(ACTIVE_PROFILE_COOKIE, viewer.id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 365 });

  redirect(plan === "free" ? "/profile?onboarding=complete" : `/pricing?selected=${encodeURIComponent(plan)}`);
}
