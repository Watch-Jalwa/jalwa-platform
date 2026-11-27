import { NextResponse } from "next/server";
import { completeJazzcashLandingLink } from "@/lib/payments/jazzcash-landing-billing.mjs";
import {
  forwardJazzcashWalletReturnToPaymentService,
  paymentServiceEnabled,
} from "@/lib/payments/payment-service";
import { publicAppOrigin } from "@/lib/public-app-origin.mjs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function collectFields(request: Request, url: URL) {
  return (async () => {
    const fields: Record<string, string> = {};
    if (request.method === "POST") {
      const contentType = request.headers.get("content-type") ?? "";
      if (contentType.includes("application/x-www-form-urlencoded")) {
        const form = await request.formData();
        for (const [key, value] of form.entries()) {
          if (typeof value === "string") fields[key] = value;
        }
      } else {
        const json = (await request.json().catch(() => ({}))) as Record<string, unknown>;
        for (const [key, value] of Object.entries(json)) {
          if (typeof value === "string") fields[key] = value;
        }
      }
    } else {
      for (const [key, value] of url.searchParams.entries()) fields[key] = value;
    }
    return fields;
  })();
}

/**
 * Digisphere merchant callback bridge (playbook §4B).
 * JazzCash posts here with productId+userId when override points at Jalwa /callback.
 */
async function tryDigisphereBridge(request: Request, url: URL, fields: Record<string, string>) {
  const productId =
    url.searchParams.get("productId")?.trim() ||
    fields.productId?.trim() ||
    "";
  const userId =
    url.searchParams.get("userId")?.trim() ||
    fields.userId?.trim() ||
    "";
  const digisphereReturn =
    Boolean(productId && userId) ||
    (paymentServiceEnabled() &&
      Object.keys(fields).some((key) => key.startsWith("pp_")) &&
      Boolean(url.searchParams.get("productId") && url.searchParams.get("userId")));

  if (!digisphereReturn || !productId || !userId) return null;

  try {
    const result = await forwardJazzcashWalletReturnToPaymentService({
      productId,
      userId,
      fields,
    });
    if (result.location) {
      // Digisphere 302 → appReturnUrl (?wallet=linked&…). Pass through to browser.
      return NextResponse.redirect(result.location, 303);
    }
    console.error("digisphere_wallet_return_no_location", {
      status: result.status,
      productId,
      userId,
    });
  } catch (error) {
    console.error(
      "digisphere_wallet_return_bridge_failed",
      error instanceof Error ? error.message : error,
    );
  }

  const failed = new URL("/billing/wallet-return", publicAppOrigin(request.url));
  failed.searchParams.set("wallet", "failed");
  return NextResponse.redirect(failed, 303);
}

async function handle(request: Request) {
  const url = new URL(request.url);
  const fields = await collectFields(request, url);

  const bridged = await tryDigisphereBridge(request, url, fields);
  if (bridged) return bridged;

  let ok = false;
  let signInHint = "";
  let orderId = "";
  try {
    if (Object.keys(fields).some((key) => key.startsWith("pp_"))) {
      const result = await completeJazzcashLandingLink(fields);
      ok = result.ok;
      signInHint = result.signInHint ?? "";
      // Stable id for TikTok Subscribe dedupe (marketing only — not entitlement proof).
      orderId = String(result.subscriptionId ?? result.requestId ?? "").trim();
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

  // DIY JazzCash path: home + toast. Digisphere path never reaches here when bridged.
  const next = new URL("/", publicAppOrigin(request.url));
  next.searchParams.set("premium", ok ? "enabled" : "failed");
  if (signInHint) next.searchParams.set("msisdn", signInHint);
  if (ok && orderId) next.searchParams.set("order", orderId);
  return NextResponse.redirect(next, 303);
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
