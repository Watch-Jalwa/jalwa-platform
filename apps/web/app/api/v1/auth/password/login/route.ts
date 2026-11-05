import { NextResponse } from "next/server";
import { passwordLogin } from "@/lib/auth/password-login.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    displayName?: unknown;
    phone?: unknown;
    password?: unknown;
    next?: unknown;
  };

  const result = await passwordLogin({
    displayName: typeof body.displayName === "string" ? body.displayName : undefined,
    phone: typeof body.phone === "string" ? body.phone : "",
    password: typeof body.password === "string" ? body.password : "",
  });

  if (!result.ok) {
    const messages: Record<string, string> = {
      "invalid-phone": "Enter a valid Pakistani mobile number.",
      "invalid-password": "Password must be 7–128 characters and include upper, lower, digit and symbol.",
      "invalid-name": result.message ?? "Enter your full name to create an account.",
      "invalid-credentials": "Mobile number or password is incorrect.",
      "signup-failed": result.message ?? "Could not create your account.",
    };
    return NextResponse.json(
      { error: result.error, message: messages[result.error] ?? "Sign-in failed." },
      { status: result.status, headers: { "Cache-Control": "no-store" } },
    );
  }

  const nextPath = typeof body.next === "string" && body.next.startsWith("/") ? body.next : "/onboarding";
  const upstream = result.response as Response;
  const response = NextResponse.json(
    {
      learner: result.learner,
      created: result.created,
      next: nextPath,
    },
    { status: 200, headers: { "Cache-Control": "no-store" } },
  );

  // Forward Better Auth session cookies from sign-up / sign-in.
  const setCookies = typeof upstream.headers.getSetCookie === "function"
    ? upstream.headers.getSetCookie()
    : [];
  if (setCookies.length) {
    for (const cookie of setCookies) response.headers.append("set-cookie", cookie);
  } else {
    const single = upstream.headers.get("set-cookie");
    if (single) response.headers.append("set-cookie", single);
  }

  return response;
}
