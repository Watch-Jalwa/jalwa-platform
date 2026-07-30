"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isFrontendPreview, safeInternalPath } from "@/lib/runtime";

const languages = new Set(["en", "ur", "roman_ur"]);

export async function requestSignupLink(formData: FormData) {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const preferredLanguage = String(formData.get("preferredLanguage") ?? "en");
  const plan = String(formData.get("plan") ?? "");
  const next = safeInternalPath(String(formData.get("next") ?? "/onboarding"), "/onboarding");
  const accepted = formData.get("acceptedTerms") === "on";
  const marketingOptIn = formData.get("marketingOptIn") === "on";

  if (displayName.length < 2 || displayName.length > 60) redirect("/signup?error=invalid-name");
  if (!email.includes("@")) redirect("/signup?error=invalid-email");
  if (!languages.has(preferredLanguage)) redirect("/signup?error=invalid-language");
  if (!accepted) redirect("/signup?error=terms-required");

  if (isFrontendPreview()) redirect(`/signup?sent=1&preview=1&email=${encodeURIComponent(email)}`);

  const supabase = await createClient();
  const callback = new URL("/auth/callback", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  const onboarding = new URL(next, callback.origin);
  if (plan) onboarding.searchParams.set("plan", plan);
  callback.searchParams.set("next", `${onboarding.pathname}${onboarding.search}`);

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: callback.toString(),
      shouldCreateUser: true,
      data: {
        display_name: displayName,
        preferred_language: preferredLanguage,
        accepted_terms: true,
        marketing_opt_in: marketingOptIn,
        onboarding_plan: plan || null,
      },
    },
  });
  if (error) redirect("/signup?error=send-failed");
  redirect(`/signup?sent=1&email=${encodeURIComponent(email)}`);
}
