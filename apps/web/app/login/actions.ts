"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isFrontendPreview, safeInternalPath } from "@/lib/runtime";

function normalizePakistanPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  if (digits.startsWith("92") && digits.length === 12) return `+${digits}`;
  if (digits.startsWith("0") && digits.length === 11) return `+92${digits.slice(1)}`;
  if (digits.startsWith("3") && digits.length === 10) return `+92${digits}`;
  return null;
}

function enabled(name: string) {
  return process.env[name] === "true";
}

export async function requestMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = safeInternalPath(String(formData.get("next") ?? "/profile"));
  if (!email || !email.includes("@")) redirect(`/login?error=invalid-email&next=${encodeURIComponent(next)}`);
  if (isFrontendPreview()) redirect(`/login?sent=1&preview=1&next=${encodeURIComponent(next)}`);

  const supabase = await createClient();
  const callback = new URL("/auth/callback", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  callback.searchParams.set("next", next);
  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: callback.toString() } });
  if (error) redirect(`/login?error=send-failed&next=${encodeURIComponent(next)}`);
  redirect(`/login?sent=1&next=${encodeURIComponent(next)}`);
}

export async function requestPhoneOtp(formData: FormData) {
  const next = safeInternalPath(String(formData.get("next") ?? "/profile"));
  if (!enabled("NEXT_PUBLIC_ENABLE_PHONE_AUTH")) redirect(`/login?error=method-disabled&next=${encodeURIComponent(next)}`);
  const phone = normalizePakistanPhone(String(formData.get("phone") ?? ""));
  if (!phone) redirect(`/login?error=invalid-phone&next=${encodeURIComponent(next)}`);
  if (isFrontendPreview()) redirect(`/login?phoneSent=1&preview=1&phone=${encodeURIComponent(phone)}&next=${encodeURIComponent(next)}`);
  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithOtp({ phone });
  if (error) redirect(`/login?error=phone-send-failed&next=${encodeURIComponent(next)}`);
  redirect(`/login?phoneSent=1&phone=${encodeURIComponent(phone)}&next=${encodeURIComponent(next)}`);
}

export async function verifyPhoneOtp(formData: FormData) {
  const next = safeInternalPath(String(formData.get("next") ?? "/profile"));
  if (!enabled("NEXT_PUBLIC_ENABLE_PHONE_AUTH")) redirect(`/login?error=method-disabled&next=${encodeURIComponent(next)}`);
  const phone = normalizePakistanPhone(String(formData.get("phone") ?? ""));
  const token = String(formData.get("token") ?? "").trim();
  if (!phone || !/^\d{6}$/.test(token)) redirect(`/login?error=invalid-code&next=${encodeURIComponent(next)}`);
  if (isFrontendPreview()) redirect(next);
  const supabase = await createClient();
  const { error } = await supabase.auth.verifyOtp({ phone, token, type: "sms" });
  if (error) redirect(`/login?error=invalid-code&phoneSent=1&phone=${encodeURIComponent(phone)}&next=${encodeURIComponent(next)}`);
  redirect(next);
}

export async function startOAuth(formData: FormData) {
  const provider = String(formData.get("provider") ?? "") as "google" | "apple" | "facebook";
  const next = safeInternalPath(String(formData.get("next") ?? "/profile"));
  if (!["google", "apple", "facebook"].includes(provider)) redirect(`/login?error=oauth-provider&next=${encodeURIComponent(next)}`);
  const featureName = `NEXT_PUBLIC_ENABLE_${provider.toUpperCase()}_AUTH`;
  if (!enabled(featureName)) redirect(`/login?error=method-disabled&next=${encodeURIComponent(next)}`);
  if (isFrontendPreview()) redirect(`/login?error=preview-oauth&next=${encodeURIComponent(next)}`);
  const supabase = await createClient();
  const callback = new URL("/auth/callback", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  callback.searchParams.set("next", next);
  const { data, error } = await supabase.auth.signInWithOAuth({ provider, options: { redirectTo: callback.toString() } });
  if (error || !data.url) redirect(`/login?error=oauth-failed&next=${encodeURIComponent(next)}`);
  redirect(data.url);
}
