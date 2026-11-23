import { NextResponse } from "next/server";
import { completeJazzcashLandingLink } from "@/lib/payments/jazzcash-landing-billing.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({})) as { fields?: unknown };
  try {
    const result = await completeJazzcashLandingLink(body.fields as Record<string, string>);
    return NextResponse.json(result, { status: result.ok ? 200 : 422, headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = typeof (error as { status?: number })?.status === "number" ? (error as { status: number }).status : 500;
    const code = error instanceof Error ? error.message : "link_complete_failed";
    return NextResponse.json({ error: code, message: "JazzCash return could not be completed." }, { status });
  }
}
