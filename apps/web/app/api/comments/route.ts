import { NextResponse } from "next/server";
import { getActiveViewerProfile } from "@/lib/customer/active-profile";
import { hasSupabaseConfig, isFrontendPreview } from "@/lib/runtime";
import { createClient } from "@/lib/supabase/server";

type CommentRow = { id: string; user_id: string; parent_id: string | null; author: string; body: string; body_language: string; score: number; reply_count: number; liked_by_me: boolean; edited_at: string | null; created_at: string; mine: boolean };
const demoComments = [
  { id: "demo-comment-1", userId: "demo-user-1", parentId: null, author: "Jalwa Viewer", body: "The player and Urdu presentation look good together.", language: "en", score: 4, replyCount: 1, likedByMe: false, editedAt: null, createdAt: "2026-07-30T18:00:00.000Z", mine: false },
  { id: "demo-comment-2", userId: "demo-user-2", parentId: "demo-comment-1", author: "Ayesha", body: "جی، موبائل براؤزر پر بھی ترتیب واضح ہے۔", language: "ur", score: 2, replyCount: 0, likedByMe: false, editedAt: null, createdAt: "2026-07-30T18:30:00.000Z", mine: false },
];
function validUuid(value: string | null | undefined) { return Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)); }

export async function GET(request: Request) {
  const contentId = new URL(request.url).searchParams.get("contentId");
  if (isFrontendPreview() || !hasSupabaseConfig() || !validUuid(contentId)) return NextResponse.json({ comments: demoComments, preview: true, settings: { commentsEnabled: true, repliesEnabled: true, slowModeSeconds: 15 } });
  const supabase = await createClient();
  const [{ data: settings }, { data: rows, error }] = await Promise.all([
    supabase.from("content_comment_settings").select("comments_enabled,replies_enabled,approval_required,slow_mode_seconds").eq("content_id", contentId).maybeSingle(),
    supabase.rpc("get_content_comments", { p_content_id: contentId }),
  ]);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  const comments = ((rows ?? []) as CommentRow[]).map((row) => ({ id: row.id, userId: row.user_id, parentId: row.parent_id, author: row.author, body: row.body, language: row.body_language, score: row.score, replyCount: row.reply_count, likedByMe: row.liked_by_me, editedAt: row.edited_at, createdAt: row.created_at, mine: row.mine }));
  return NextResponse.json({ comments, preview: false, settings: { commentsEnabled: settings?.comments_enabled ?? true, repliesEnabled: settings?.replies_enabled ?? true, approvalRequired: settings?.approval_required ?? false, slowModeSeconds: settings?.slow_mode_seconds ?? 15 } });
}

export async function POST(request: Request) {
  if (isFrontendPreview() || !hasSupabaseConfig()) return NextResponse.json({ ok: true, preview: true, id: crypto.randomUUID() });
  const body = await request.json().catch(() => ({})) as { contentId?: string; parentId?: string | null; body?: string; language?: string };
  if (!validUuid(body.contentId) || (body.parentId && !validUuid(body.parentId)) || !body.body?.trim()) return NextResponse.json({ error: "Invalid comment." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in to comment.", code: "sign_in_required" }, { status: 401 });
  const profile = await getActiveViewerProfile(user.id);
  if (!profile || profile.kids_mode) return NextResponse.json({ error: "Comments are unavailable for this viewer profile." }, { status: 403 });
  const { data, error } = await supabase.rpc("create_comment", { p_viewer_profile_id: profile.id, p_content_id: body.contentId, p_parent_id: body.parentId ?? null, p_body: body.body.trim(), p_language: body.language ?? "en" });
  if (error) return NextResponse.json({ error: error.message }, { status: error.message.includes("slow mode") ? 429 : error.message.includes("disabled") ? 403 : 400 });
  return NextResponse.json({ ok: true, id: data });
}

export async function PATCH(request: Request) {
  const body = await request.json().catch(() => ({})) as { commentId?: string; body?: string; language?: string; action?: "edit" | "delete" };
  if (!validUuid(body.commentId) || !["edit","delete"].includes(body.action ?? "")) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Sign in required." }, { status: 401 });
  const result = body.action === "delete" ? await supabase.rpc("delete_comment", { p_comment_id: body.commentId }) : await supabase.rpc("edit_comment", { p_comment_id: body.commentId, p_body: body.body?.trim() ?? "", p_language: body.language ?? "en" });
  if (result.error) return NextResponse.json({ error: result.error.message }, { status: 400 });
  return NextResponse.json({ ok: true });
}
