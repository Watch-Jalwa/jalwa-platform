import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getReadinessDetails } from "@/lib/readiness";
import { authorizeInternalRequest } from "@/lib/security/internal-auth";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const requestId = request.headers.get("x-request-id") || randomUUID();
  if (!authorizeInternalRequest(request)) {
    return NextResponse.json({ error: "unauthorized", requestId }, {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
        "WWW-Authenticate": "Bearer",
      },
    });
  }

  const details = await getReadinessDetails();
  return NextResponse.json({ ...details, requestId }, {
    status: details.ready ? 200 : 503,
    headers: { "Cache-Control": "no-store" },
  });
}
