import { NextResponse } from "next/server";
import { accountExportUrl } from "@/lib/privacy/storage";
import { createClient } from "@/lib/supabase/server";

type Params = Promise<{ requestId: string }>;
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(_: Request, { params }: { params: Params }) {
  const { requestId } = await params;
  if (!uuidPattern.test(requestId)) return NextResponse.json({ error: "Invalid export request." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(new URL(`/login?next=/api/account/export/${requestId}`, process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000"), 303);
  const { data, error } = await supabase.from("account_requests")
    .select("id,status,request_type,result_storage_key,result_expires_at")
    .eq("id", requestId).eq("user_id", user.id).maybeSingle();
  if (error) return NextResponse.json({ error: "Export request unavailable." }, { status: 503 });
  if (!data || data.request_type !== "export") return NextResponse.json({ error: "Export request not found." }, { status: 404 });
  if (data.status !== "completed" || !data.result_storage_key || !data.result_expires_at) return NextResponse.json({ error: "Export is not ready." }, { status: 409 });
  if (new Date(data.result_expires_at).getTime() <= Date.now()) return NextResponse.json({ error: "This export link expired. Request a new export." }, { status: 410 });
  const url = await accountExportUrl(data.result_storage_key, data.id);
  return NextResponse.redirect(url, 303);
}
