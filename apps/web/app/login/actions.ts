"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isFrontendPreview, safeInternalPath } from "@/lib/runtime";

function enabled(name: string) { return process.env[name] === "true"; }

export async function requestMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeInternalPath(String(formData.get("next") ?? "/profile"));
  if (!email || !email.includes("@")) redirect(`/login?error=invalid-email&next=${encodeURIComponent(next)}`);
  if (isFrontendPreview()) redirect(`/login?sent=1&preview=1&next=${encodeURIComponent(next)}`);
  try {
    await auth.api.signInMagicLink({ body: { email, callbackURL: next }, headers: await headers() });
  } catch {
    redirect(`/login?error=send-failed&next=${encodeURIComponent(next)}`);
  }
  redirect(`/login?sent=1&next=${encodeURIComponent(next)}`);
}

export async function requestPhoneOtp(formData: FormData) {
  const next = safeInternalPath(String(formData.get("next") ?? "/profile"));
  // Phone authentication remains intentionally off until an approved SMS provider is configured.
  redirect(`/login?error=method-disabled&next=${encodeURIComponent(next)}`);
}

export async function verifyPhoneOtp(formData: FormData) {
  const next = safeInternalPath(String(formData.get("next") ?? "/profile"));
  redirect(`/login?error=method-disabled&next=${encodeURIComponent(next)}`);
}

export async function startOAuth(formData: FormData) {
  const provider = String(formData.get("provider") ?? "") as "google" | "apple" | "facebook";
  const next = safeInternalPath(String(formData.get("next") ?? "/profile"));
  if (!["google", "apple", "facebook"].includes(provider)) redirect(`/login?error=oauth-provider&next=${encodeURIComponent(next)}`);
  if (!enabled(`NEXT_PUBLIC_ENABLE_${provider.toUpperCase()}_AUTH`)) redirect(`/login?error=method-disabled&next=${encodeURIComponent(next)}`);
  if (isFrontendPreview()) redirect(`/login?error=preview-oauth&next=${encodeURIComponent(next)}`);
  try {
    const data = await auth.api.signInSocial({ body: { provider, callbackURL: next }, headers: await headers() });
    const url = data && typeof data === "object" && "url" in data ? String(data.url ?? "") : "";
    if (!url) redirect(`/login?error=oauth-failed&next=${encodeURIComponent(next)}`);
    redirect(url);
  } catch {
    redirect(`/login?error=oauth-failed&next=${encodeURIComponent(next)}`);
  }
}
