"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/studio/auth";

export async function moderateComment(formData: FormData) {
  const { supabase, profile } = await requireStaff();
  if (!["editor","admin"].includes(profile.role)) redirect("/studio");
  const commentId = String(formData.get("commentId") ?? "");
  const action = String(formData.get("action") ?? "");
  const reason = String(formData.get("reason") ?? "").trim() || null;
  const { error } = await supabase.rpc("moderate_comment", { p_comment_id: commentId, p_action: action, p_reason: reason });
  if (error) redirect(`/studio/moderation?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/studio/moderation");
}

export async function resolveReport(formData: FormData) {
  const { supabase, profile } = await requireStaff();
  if (!["editor","admin"].includes(profile.role)) redirect("/studio");
  const reportId = String(formData.get("reportId") ?? "");
  const status = String(formData.get("status") ?? "resolved");
  const note = String(formData.get("note") ?? "").trim() || null;
  const { error } = await supabase.rpc("resolve_content_report", { p_report_id: reportId, p_status: status, p_note: note });
  if (error) redirect(`/studio/moderation?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/studio/moderation");
}

export async function updateCommentSettings(formData: FormData) {
  const { supabase, user, profile } = await requireStaff();
  if (!["editor","admin"].includes(profile.role)) redirect("/studio");
  const contentId = String(formData.get("contentId") ?? "");
  const slowMode = Math.max(0, Math.min(Number(formData.get("slowModeSeconds") ?? 15), 3600));
  const { error } = await supabase.from("content_comment_settings").upsert({ content_id: contentId, comments_enabled: formData.get("commentsEnabled") === "on", replies_enabled: formData.get("repliesEnabled") === "on", approval_required: formData.get("approvalRequired") === "on", slow_mode_seconds: slowMode, updated_by: user.id });
  if (error) redirect(`/studio/moderation?error=${encodeURIComponent(error.message)}`);
  revalidatePath("/studio/moderation");
}
