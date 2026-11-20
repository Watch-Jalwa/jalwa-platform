import { NextResponse } from "next/server";
import { verifyOtp } from "@/lib/auth/otp";
import { safeInternalPath } from "@/lib/runtime";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { challengeId?: unknown; code?: unknown; displayName?: unknown; next?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid-code" }, { status: 400 });
  }

  const next = safeInternalPath(typeof body.next === "string" ? body.next : "/onboarding", "/onboarding");
  const result = await verifyOtp({
    challengeId: String(body.challengeId ?? ""),
    code: String(body.code ?? ""),
    displayName: typeof body.displayName === "string" ? body.displayName : undefined,
    next,
  });
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({ ok: true, next: result.next });
}
