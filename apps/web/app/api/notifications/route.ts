import { NextResponse } from "next/server";
import { createClient } from "@/lib/database/server";

type NotificationRow = { id: string; kind: string; content_id: string | null; comment_id: string | null; payload: Record<string, unknown>; read_at: string | null; created_at: string; actor: string; content_slug: string | null; content_title: string | null };

export async function GET() {
  const database = await createClient();
  const { data: { user } } = await database.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data, error } = await database.rpc("get_my_notifications", { p_limit: 100 });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ items: ((data ?? []) as NotificationRow[]).map((row) => ({ id: row.id, kind: row.kind, contentId: row.content_id, commentId: row.comment_id, payload: row.payload, readAt: row.read_at, createdAt: row.created_at, actor: row.actor, content: row.content_id ? { slug: row.content_slug, title_en: row.content_title } : null })) });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({})) as { id?: string; all?: boolean };
  const database = await createClient();
  const { data: { user } } = await database.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const { data, error } = await database.rpc("mark_notifications_read", { p_notification_id: body.all ? null : body.id ?? null });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json({ ok: true, updated: data });
}
