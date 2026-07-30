import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { refreshSemanticRecommendations } from "@/lib/recommendations/semantic";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function validSecret(request: Request) {
  const expected = process.env.RECOMMENDATION_REFRESH_SECRET;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  if (!expected || !provided) return false;
  const a = Buffer.from(expected); const b = Buffer.from(provided);
  return a.length === b.length && timingSafeEqual(a,b);
}

export async function POST(request: Request) {
  if (!validSecret(request)) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  try {
    const result = await refreshSemanticRecommendations();
    return NextResponse.json({ ok: true, ...result, refreshedAt: new Date().toISOString() });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Recommendation refresh failed.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
