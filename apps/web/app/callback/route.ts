import { NextResponse } from "next/server";
import { completeJazzcashLandingLink } from "@/lib/payments/jazzcash-landing-billing.mjs";
import { publicAppOrigin } from "@/lib/public-app-origin.mjs";

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
  try {
    if (Object.keys(fields).some((key) => key.startsWith("pp_"))) {
      const result = await completeJazzcashLandingLink(fields);
      ok = result.ok;
      signInHint = result.signInHint ?? "";
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
  return NextResponse.redirect(next, 303);
}

export async function GET(request: Request) {
  return handle(request);
}

export async function POST(request: Request) {
  return handle(request);
}
