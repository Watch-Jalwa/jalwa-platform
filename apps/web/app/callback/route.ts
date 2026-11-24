import { NextResponse } from "next/server";
import { completeJazzcashLandingLink } from "@/lib/payments/jazzcash-landing-billing.mjs";
import { publicAppOrigin } from "@/lib/public-app-origin.mjs";
import { createConversionReceipt, RECEIPT_COOKIE } from "@/lib/reports/campaign-conversion-receipt.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handle(request: Request) {
  const url = new URL(request.url);
  const fields: Record<string, string> = {};

  if (request.method === "POST") {
    const contentType = request.headers.get("content-type") ?? "";
    if (contentType.includes("application/x-www-form-urlencoded")) {
      const form = await request.formData();
      for (const [key, value] of form.entries()) {
        if (typeof value === "string") fields[key] = value;
      }
    } else {
      const json = await request.json().catch(() => ({})) as Record<string, unknown>;
      for (const [key, value] of Object.entries(json)) {
        if (typeof value === "string") fields[key] = value;
      }
    }
  } else {
    for (const [key, value] of url.searchParams.entries()) fields[key] = value;
  }

  let ok = false;
  let signInHint = "";
  let orderId = "";
  let receipt:string|null=null;
  try {
    if (Object.keys(fields).some((key) => key.startsWith("pp_"))) {
      const result = await completeJazzcashLandingLink(fields);
      ok = result.ok;
      signInHint = result.signInHint ?? "";
      // Stable id for TikTok Subscribe dedupe (marketing only — not entitlement proof).
      // Linking a wallet is not a successful charge. Only a completed local subscription qualifies.
      orderId = result.ok ? String(result.subscriptionId ?? "").trim() : "";
      if(orderId && result.planCode && process.env.BETTER_AUTH_SECRET){
        receipt=createConversionReceipt(orderId,result.planCode,process.env.BETTER_AUTH_SECRET);
      }
      if (!ok) {
        console.error("jazzcash_callback_not_ok", {
          requestId: result.requestId,
          status: result.status,
          message: result.message,
        });
      }
    }
  } catch (error) {
    console.error("jazzcash_callback_failed", error instanceof Error ? error.message : error);
    ok = false;
  }

  // Home + toast — not /callback/result. Rewrite 0.0.0.0 bind hosts to localhost.
  const next = new URL("/", publicAppOrigin(request.url));
  next.searchParams.set("premium", ok ? "enabled" : "failed");
  if (signInHint) next.searchParams.set("msisdn", signInHint);
  if (ok && orderId) next.searchParams.set("order", orderId);
  // JazzCash posts cross-site into /callback. SameSite=Lax cookies set on that
  // response are often dropped, so also pass the short-lived signed receipt on
  // the redirect URL for Subscribe verification (marketing only, 10 min TTL).
  if (ok && orderId && receipt) next.searchParams.set("cv", receipt);
  if (ok && !orderId) {
    console.error("jazzcash_callback_ok_without_subscription", {
      hasReceipt: Boolean(receipt),
    });
  }
  const response=NextResponse.redirect(next,303);
  if(receipt){
    response.cookies.set(RECEIPT_COOKIE,receipt,{
      httpOnly:true,
      secure:next.protocol==="https:",
      // None so the cookie can stick after a cross-site JazzCash POST return.
      sameSite: next.protocol==="https:" ? "none" : "lax",
      path:"/api/campaign/conversion-receipt",
      maxAge:600,
    });
  }
  return response;
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
