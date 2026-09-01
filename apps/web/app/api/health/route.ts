import { NextResponse } from "next/server";
import { databasePool } from "@/lib/database/pool";

export const dynamic = "force-dynamic";

export async function GET() {
  let database: "ready" | "unavailable" = "ready";
  let status = 200;

  try {
    await databasePool.query("select 1");
  } catch (error) {
    database = "unavailable";
    status = 503;
    console.error("health_database_failed", error instanceof Error ? error.message : String(error));
  }

  return NextResponse.json({
    service: "jalwa-web",
    status: status === 200 ? "ready" : "not_ready",
    database,
    version: process.env.GIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA ?? "local",
    time: new Date().toISOString(),
  }, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}
