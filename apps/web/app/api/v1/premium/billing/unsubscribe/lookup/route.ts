import { NextResponse } from "next/server";
import { lookupPremiumByJazzcashMsisdn } from "@/lib/payments/unsubscribe-by-msisdn.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { msisdn?: unknown };
  try {
    const result = await lookupPremiumByJazzcashMsisdn(String(body.msisdn ?? ""));
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = typeof (error as { status?: number })?.status === "number"
      ? (error as { status: number }).status
      : 500;
    const code = error instanceof Error ? error.message : "lookup_failed";
    const messages: Record<string, string> = {
      invalid_msisdn: "Enter a valid JazzCash mobile number (03XXXXXXXXX).",
    };
    return NextResponse.json(
      { error: code, message: messages[code] ?? "Could not check this JazzCash number." },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
