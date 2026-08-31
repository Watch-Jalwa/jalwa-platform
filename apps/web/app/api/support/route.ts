import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/database/admin";
import { createClient } from "@/lib/database/server";
import { requestRateKey } from "@/lib/security/request-key";

export const runtime = "nodejs";

const caseTypes = new Set(["general", "billing", "playback", "copyright", "ai-safety", "account"]);

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const subject = String(body.subject ?? "").trim();
  const message = String(body.message ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const caseType = String(body.caseType ?? "general");

  if (!caseTypes.has(caseType) || subject.length < 3 || subject.length > 160 || message.length < 10 || message.length > 5000) {
    return NextResponse.json({ error: "Please check the form fields." }, { status: 400 });
  }
  if (email && (!email.includes("@") || email.length > 254)) {
    return NextResponse.json({ error: "Enter a valid email." }, { status: 400 });
  }

  const database = await createClient();
  const { data: { user } } = await database.auth.getUser();
  if (!user && !email) return NextResponse.json({ error: "Email is required when signed out." }, { status: 400 });

  const admin = createAdminClient();
  const bucket = requestRateKey(request, "support", user?.id);
  const { data: allowed, error: rateError } = await admin.rpc("consume_rate_limit", {
    p_bucket_key: bucket,
    p_limit: 5,
    p_window_seconds: 3600,
  });
  if (rateError) return NextResponse.json({ error: "Support is temporarily unavailable." }, { status: 503 });
  if (!allowed) return NextResponse.json({ error: "Too many requests. Please try again later." }, { status: 429 });

  const contactEmail = user?.email ?? (email || null);
  const { data, error } = await admin.from("support_cases").insert({
    user_id: user?.id ?? null,
    email: contactEmail,
    case_type: caseType,
    subject,
    message,
    metadata: { source: "web", path: request.headers.get("referer") ?? null },
  }).select("id").single();

  if (error) return NextResponse.json({ error: "Could not create the support request." }, { status: 500 });
  return NextResponse.json({ id: data.id, status: "received" }, { status: 201 });
}
