import { NextResponse } from "next/server";
import { safeInternalPath } from "@/lib/runtime";

// Better Auth handles magic-link and OAuth callbacks under /api/auth/*.
// This route remains only as a safe compatibility redirect for old bookmarked links.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const next = safeInternalPath(url.searchParams.get("next") ?? "/profile");
  return NextResponse.redirect(new URL(next, url.origin));
}
