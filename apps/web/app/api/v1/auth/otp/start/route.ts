import { NextResponse } from "next/server";
import { startOtp } from "@/lib/auth/otp";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  let body: { identity?: unknown } = {};
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid-identity" }, { status: 400 });
  }

  const result = await startOtp(String(body.identity ?? ""));
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status });

  return NextResponse.json({
    challengeId: result.challengeId,
    channel: result.channel,
    maskedDestination: result.maskedDestination,
    expiresAt: result.expiresAt,
    preview: result.preview === true,
  });
}
