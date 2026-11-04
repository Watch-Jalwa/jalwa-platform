"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { isFrontendPreview, safeInternalPath } from "@/lib/runtime";

function enabled(name: string) { return process.env[name] === "true"; }

export async function startOAuth(formData: FormData) {
  const provider = String(formData.get("provider") ?? "") as "google" | "apple" | "facebook";
  const next = safeInternalPath(String(formData.get("next") ?? "/onboarding"), "/onboarding");
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
