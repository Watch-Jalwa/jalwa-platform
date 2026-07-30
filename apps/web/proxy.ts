import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

export async function proxy(request: NextRequest) {
  const isFrontendPreview = process.env.NEXT_PUBLIC_FRONTEND_PREVIEW === "true" || process.env.VERCEL_ENV === "preview";
  const hasSupabase = Boolean(
    process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  );

  if (isFrontendPreview || !hasSupabase) return NextResponse.next();
  return updateSession(request);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|icon-maskable.svg|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
