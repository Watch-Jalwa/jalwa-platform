import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data, error } = await supabase.from("notifications")
    .select("id,kind,content_id,comment_id,payload,read_at,created_at,actor_id,profiles!notifications_actor_id_fkey(display_name),content_items(slug,title_en)")
    .eq("user_id", user.id).order("created_at", { ascending: false }).limit(100);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: (data ?? []).map((row) => ({ id: row.id, kind: row.kind, contentId: row.content_id, commentId: row.comment_id, payload: row.payload, readAt: row.read_at, createdAt: row.created_at, actor: (row.profiles as { display_name?: string } | null)?.display_name ?? "Jalwa", content: row.content_items })) });
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
