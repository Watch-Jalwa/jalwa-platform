import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data, error } = await supabase.rpc("get_my_notifications", { p_limit: 100 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: (data ?? []).map((row) => ({ id: row.id, kind: row.kind, contentId: row.content_id, commentId: row.comment_id, payload: row.payload, readAt: row.read_at, createdAt: row.created_at, actor: row.actor, content: row.content_id ? { slug: row.content_slug, title_en: row.content_title } : null })) });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({})) as { id?: string; all?: boolean };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  let query = supabase.from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", user.id).is("read_at", null);
  if (!body.all && body.id) query = query.eq("id", body.id);
  const { error } = await query;
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
