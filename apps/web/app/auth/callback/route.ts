import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = url.searchParams.get("next");
  const safeNext = next?.startsWith("/") && !next.startsWith("//") ? next : "/profile";
  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      const { data: { user } } = await supabase.auth.getUser();
      if (user && safeNext === "/profile") {
        const { data: profile } = await supabase.from("profiles").select("onboarding_completed").eq("id", user.id).maybeSingle();
        if (!profile?.onboarding_completed) return NextResponse.redirect(new URL("/onboarding", url.origin));
      }
      return NextResponse.redirect(new URL(safeNext, url.origin));
    }
  }
  return NextResponse.redirect(new URL("/login?error=callback-failed", url.origin));
}
