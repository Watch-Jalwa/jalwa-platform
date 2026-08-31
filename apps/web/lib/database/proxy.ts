import { NextResponse, type NextRequest } from "next/server";
import { getSessionCookie } from "better-auth/cookies";

export async function updateSession(request: NextRequest) {
  // Better Auth owns session rotation on its API boundary. Proxy performs only an
  // inexpensive cookie-presence check; protected routes validate the session server-side.
  getSessionCookie(request);
  return NextResponse.next({ request });
}
