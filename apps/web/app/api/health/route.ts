import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

export async function GET() {
  return NextResponse.json({
    service: "jalwa-web",
    status: "ready",
    version: process.env.GIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    time: new Date().toISOString(),
  }, { headers: { "Cache-Control": "no-store" } });
}
