"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isFrontendPreview, safeInternalPath } from "@/lib/runtime";

const languages = new Set(["en", "ur", "roman_ur"]);

export async function requestSignupLink(formData: FormData) {
  const displayName = String(formData.get("displayName") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const preferredLanguage = String(formData.get("preferredLanguage") ?? "en");
  const plan = String(formData.get("plan") ?? "");
  const next = safeInternalPath(String(formData.get("next") ?? "/onboarding"), "/onboarding");
  const accepted = formData.get("acceptedTerms") === "on";
  if (displayName.length < 2 || displayName.length > 60) redirect("/signup?error=invalid-name");
  if (!email.includes("@")) redirect("/signup?error=invalid-email");
  if (!languages.has(preferredLanguage)) redirect("/signup?error=invalid-language");
  if (!accepted) redirect("/signup?error=terms-required");
  if (isFrontendPreview()) redirect(`/signup?sent=1&preview=1&email=${encodeURIComponent(email)}`);

  const onboarding = new URL(next, process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  if (plan) onboarding.searchParams.set("plan", plan);
  try {
    await auth.api.signInMagicLink({
      body: {
        email,
        name: displayName,
        callbackURL: `${onboarding.pathname}${onboarding.search}`,
        metadata: { preferredLanguage, acceptedTerms: true },
      },
      headers: await headers(),
    });
  } catch {
    redirect("/signup?error=send-failed");
  }
  redirect(`/signup?sent=1&email=${encodeURIComponent(email)}`);
}
