import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

function isCampaignPath(pathname: string) {
  return (
    pathname === "/landing1"
    || pathname === "/mainLanding"
    || pathname.startsWith("/callback")
  );
}

export async function proxy(request: NextRequest) {
  const isFrontendPreview = process.env.NEXT_PUBLIC_FRONTEND_PREVIEW === "true" || process.env.VERCEL_ENV === "preview";
  // Better Auth owns session rotation on its API boundary. Proxy performs only an
  // inexpensive cookie-presence check when a backend is configured.
  if (!isFrontendPreview && process.env.DATABASE_URL) {
    getSessionCookie(request);
  }

  const requestHeaders = new Headers(request.headers);
  if (isCampaignPath(request.nextUrl.pathname)) {
    requestHeaders.set("x-jalwa-campaign", "1");
  }

  return NextResponse.next({
    request: { headers: requestHeaders },
  });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|icon-maskable.svg|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)"],
};
