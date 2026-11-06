import { NextResponse } from "next/server";
import { inquireJazzcashLandingStatus } from "@/lib/payments/jazzcash-landing-billing.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as {
    txnRefNo?: unknown;
    requestId?: unknown;
  };

  try {
    const result = await inquireJazzcashLandingStatus({
      txnRefNo: typeof body.txnRefNo === "string" ? body.txnRefNo : undefined,
      requestId: typeof body.requestId === "string" ? body.requestId : undefined,
    });
    return NextResponse.json(result, {
      status: result.ok ? 200 : 422,
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    const status = typeof (error as { status?: number })?.status === "number"
      ? (error as { status: number }).status
      : 500;
    const code = error instanceof Error ? error.message : "inquiry_failed";
    const messages: Record<string, string> = {
      jazzcash_unconfigured: "JazzCash is not configured on this environment.",
      missing_txn_ref: "Provide txnRefNo or a requestId that already has a charge reference.",
      unknown_request: "No JazzCash wallet-link intent matches that requestId.",
      unknown_txn_ref: "No JazzCash wallet-link intent matches that txnRefNo.",
      invalid_txn_ref: "txnRefNo is invalid.",
    };
    return NextResponse.json(
      { error: code, message: messages[code] ?? "JazzCash status inquiry failed." },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
