import { respondToJazzcashIpn } from "@/lib/payments/jazzcash-ipn-http.mjs";

/** Compat alias of /jazzcash/ipn for JazzCash merchant allowlisting. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return respondToJazzcashIpn(request);
}

export async function POST(request: Request) {
  return respondToJazzcashIpn(request);
}
