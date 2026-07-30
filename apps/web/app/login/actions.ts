"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export async function requestMagicLink(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const next = String(formData.get("next") ?? "/profile");
  if (!email || !email.includes("@")) redirect(`/login?error=invalid-email&next=${encodeURIComponent(next)}`);

  const supabase = await createClient();
  const callback = new URL("/auth/callback", process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
  callback.searchParams.set("next", next.startsWith("/") && !next.startsWith("//") ? next : "/profile");

  const { error } = await supabase.auth.signInWithOtp({ email, options: { emailRedirectTo: callback.toString() } });
  if (error) redirect(`/login?error=send-failed&next=${encodeURIComponent(next)}`);
  redirect("/login?sent=1");
}
