import { NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";

type Params = Promise<{ commentId: string }>;

export async function POST(request: Request, { params }: { params: Params }) {
  const { commentId } = await params;
  const body = await request.json().catch(() => ({})) as { reason?: string; details?: string; blockUserId?: string; muteUserId?: string };
  const database = await createClient();
  const { data: { user } } = await database.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to report." }, { status: 401 });
  if (body.blockUserId) {
    const { error } = await database.rpc("set_user_block", { p_blocked_user_id: body.blockUserId, p_block: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (body.muteUserId) {
    const { error } = await database.rpc("set_user_mute", { p_entity_type: "user", p_entity_id: body.muteUserId, p_mute: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (body.reason) {
    const allowed = new Set(["spam","abuse","hate","harassment","misinformation","rights","other"]);
    if (!allowed.has(body.reason)) return NextResponse.json({ error: "Invalid report reason." }, { status: 400 });
    const { error } = await database.rpc("report_comment", { p_comment_id: commentId, p_reason: body.reason, p_details: body.details?.slice(0,1000) ?? null });
    if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  }
  return NextResponse.json({ ok: true });
}
