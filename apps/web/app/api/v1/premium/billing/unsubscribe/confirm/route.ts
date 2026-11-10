import { NextResponse } from "next/server";
import { unsubscribePremiumByJazzcashMsisdn } from "@/lib/payments/unsubscribe-by-msisdn.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    msisdn?: unknown;
    confirm?: unknown;
  };

  if (body.confirm !== true) {
    return NextResponse.json(
      { error: "confirm_required", message: "Confirm that you want to cancel the subscription." },
      { status: 400, headers: { "Cache-Control": "no-store" } },
    );
  }

  try {
    const result = await unsubscribePremiumByJazzcashMsisdn(String(body.msisdn ?? ""), {
      source: "header",
    });
    return NextResponse.json(result, {
      status: result.ok ? 200 : 404,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const status = typeof (error as { status?: number })?.status === "number"
      ? (error as { status: number }).status
      : 500;
    const code = error instanceof Error ? error.message : "unsubscribe_failed";
    const messages: Record<string, string> = {
      invalid_msisdn: "Enter a valid JazzCash mobile number (03XXXXXXXXX).",
    };
    return NextResponse.json(
      { error: code, message: messages[code] ?? "Could not cancel Premium right now." },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
