import { NextResponse } from "next/server";
import { startJazzcashLandingLink } from "@/lib/payments/jazzcash-landing-billing.mjs";
import { PaymentServiceError } from "@/lib/payments/payment-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    planCode?: unknown;
    msisdn?: unknown;
    consentToAutoPay?: unknown;
    idempotencyKey?: unknown;
    attribution?: unknown;
  };

  try {
    const result = await startJazzcashLandingLink({
      planCode: String(body.planCode ?? ""),
      msisdn: String(body.msisdn ?? ""),
      consentToAutoPay: body.consentToAutoPay === true,
      idempotencyKey: typeof body.idempotencyKey === "string" ? body.idempotencyKey : undefined,
      attribution: body.attribution && typeof body.attribution === "object" ? body.attribution as Record<string, unknown> : {},
    });
    return NextResponse.json(result, { status: 201, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    if (error instanceof PaymentServiceError) {
      return NextResponse.json({ error: error.code, message: error.message }, { status: error.status });
    }
    const status = typeof (error as { status?: number })?.status === "number" ? (error as { status: number }).status : 500;
    const code = error instanceof Error ? error.message : "link_start_failed";
    const messages: Record<string, string> = {
      consent_required: "Agree to the Terms before continuing.",
      invalid_msisdn: "Enter a valid JazzCash mobile number.",
      invalid_plan: "Select a valid plan.",
      jazzcash_unconfigured: "JazzCash is not configured on this environment.",
    };
    return NextResponse.json({ error: code, message: messages[code] ?? "JazzCash linking could not be started." }, { status });
  }
}
