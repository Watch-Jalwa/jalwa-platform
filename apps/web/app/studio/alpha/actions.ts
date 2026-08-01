"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/studio/auth";
import { invalidateProcessedMedia } from "@/lib/media/storage";

type AlphaSupabase = Awaited<ReturnType<typeof requireStaff>>["supabase"];

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item.trim() : "";
}

function alphaPath(error?: string) {
  return error ? `/studio/alpha?error=${encodeURIComponent(error)}` : "/studio/alpha";
}

function booleanValue(formData: FormData, key: string) {
  return value(formData, key) === "true";
}

function optionalExpiry(formData: FormData) {
  const raw = value(formData, "expiresAt");
  if (!raw) return null;
  const date = new Date(`${raw}T23:59:59.999Z`);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function refreshAlpha() {
  revalidatePath("/studio/alpha");
  revalidatePath("/studio/content");
  revalidatePath("/");
  revalidatePath("/explore");
  revalidatePath("/shorts");
  revalidatePath("/live");
}

async function collectContentIds(supabase: AlphaSupabase, filter: { sourceId?: string; available?: boolean }) {
  const ids: string[] = [];
  const pageSize = 1000;
  for (let from = 0; ; from += pageSize) {
    let query = supabase.from("content_items").select("id").order("id").range(from, from + pageSize - 1);
    if (filter.sourceId) query = query.eq("source_account_id", filter.sourceId);
    if (filter.available !== undefined) query = query.eq("is_available", filter.available);
    const { data, error } = await query;
    if (error) throw error;
    ids.push(...(data ?? []).map((item) => item.id));
    if ((data ?? []).length < pageSize) break;
  }
  return ids;
}

async function invalidateContentMedia(supabase: AlphaSupabase, contentIds: string[]) {
  if ((process.env.MEDIA_BACKEND ?? "r2").toLowerCase() !== "aws" || !contentIds.length) return;
  const entries: { contentId: string; assetId: string }[] = [];
  for (let index = 0; index < contentIds.length; index += 100) {
    const { data, error } = await supabase.from("playback_sources")
      .select("content_id,media_asset_id")
      .in("content_id", contentIds.slice(index, index + 100))
      .not("media_asset_id", "is", null);
    if (error) throw error;
    entries.push(...(data ?? [])
      .filter((row) => Boolean(row.media_asset_id))
      .map((row) => ({ contentId: row.content_id, assetId: row.media_asset_id as string })));
  }
  const unique = [...new Map(entries.map((entry) => [`${entry.contentId}/${entry.assetId}`, entry])).values()];
  for (let index = 0; index < unique.length; index += 1000) {
    await invalidateProcessedMedia(unique.slice(index, index + 1000)).catch((error) => {
      console.error("AWS media invalidation failed", { count: unique.length, error: String(error) });
    });
  }
}

export async function setSourceAvailabilityAction(formData: FormData) {
  const { supabase, profile } = await requireStaff();
  if (!["rights_reviewer", "admin"].includes(profile.role)) redirect(alphaPath("Rights reviewer access is required."));
  const sourceId = value(formData, "sourceId");
  const enabled = booleanValue(formData, "enabled");
  const reason = value(formData, "reason") || (enabled ? "Approved source enabled for alpha discovery." : "Source disabled from alpha.");
  const affectedItems = enabled ? [] : await collectContentIds(supabase, { sourceId });
  const { error } = await supabase.rpc("set_source_availability", {
    p_source_id: sourceId,
    p_enabled: enabled,
    p_reason: reason,
  });
  if (error) redirect(alphaPath(error.message));
  if (!enabled) await invalidateContentMedia(supabase, affectedItems);
  refreshAlpha();
  redirect(alphaPath());
}

export async function setContentAvailabilityAction(formData: FormData) {
  const { supabase } = await requireStaff();
  const contentId = value(formData, "contentId");
  const enabled = booleanValue(formData, "enabled");
  const reason = value(formData, "reason") || (enabled ? "Content enabled for internal alpha." : "Content disabled from internal alpha.");
  const { error } = await supabase.rpc("set_content_availability", {
    p_content_id: contentId,
    p_enabled: enabled,
    p_reason: reason,
  });
  if (error) redirect(alphaPath(error.message));
  if (!enabled) await invalidateContentMedia(supabase, [contentId]);
  refreshAlpha();
  redirect(alphaPath());
}

export async function setRightsHoldAction(formData: FormData) {
  const { supabase, profile } = await requireStaff();
  if (!["rights_reviewer", "admin"].includes(profile.role)) redirect(alphaPath("Rights reviewer access is required."));
  const contentId = value(formData, "contentId");
  const hold = booleanValue(formData, "hold");
  const reason = value(formData, "reason") || (hold ? "Copyright review required." : "Rights hold released after review.");
  const { error } = await supabase.rpc("set_rights_hold", {
    p_content_id: contentId,
    p_hold: hold,
    p_reason: reason,
  });
  if (error) redirect(alphaPath(error.message));
  if (hold) await invalidateContentMedia(supabase, [contentId]);
  refreshAlpha();
  redirect(alphaPath());
}

export async function setInternalAlphaStateAction(formData: FormData) {
  const { supabase, profile } = await requireStaff();
  if (profile.role !== "admin") redirect(alphaPath("Administrator access is required."));
  const enabled = booleanValue(formData, "enabled");
  const inviteOnly = booleanValue(formData, "inviteOnly");
  if (enabled || !inviteOnly) redirect(alphaPath("Activation and access-mode changes require the protected exact-SHA workflow."));
  const reason = value(formData, "reason") || "Internal alpha emergency shutdown.";
  const availableItems = await collectContentIds(supabase, { available: true });
  const { error } = await supabase.rpc("set_internal_alpha_state", {
    p_enabled: enabled,
    p_invite_only: inviteOnly,
    p_reason: reason,
  });
  if (error) redirect(alphaPath(error.message));
  await invalidateContentMedia(supabase, availableItems);
  refreshAlpha();
  redirect(alphaPath());
}

export async function setAlphaAccessGrantAction(formData: FormData) {
  const { supabase, profile } = await requireStaff();
  if (profile.role !== "admin") redirect(alphaPath("Administrator access is required."));
  const userId = value(formData, "userId");
  const enabled = booleanValue(formData, "enabled");
  const reason = value(formData, "reason") || (enabled ? "Internal alpha tester access." : "Internal alpha access revoked.");
  const { error } = await supabase.rpc("set_alpha_access_grant", {
    p_user_id: userId,
    p_enabled: enabled,
    p_expires_at: enabled ? optionalExpiry(formData) : null,
    p_reason: reason,
  });
  if (error) redirect(alphaPath(error.message));
  refreshAlpha();
  redirect(alphaPath());
}

export async function reviewSourceItemAction(formData: FormData) {
  const { supabase, profile } = await requireStaff();
  if (!["rights_reviewer", "admin"].includes(profile.role)) redirect(alphaPath("Rights reviewer access is required."));
  const sourceItemId = value(formData, "sourceItemId");
  const decision = value(formData, "decision");
  const reason = value(formData, "reason") || `Source item ${decision}.`;
  const { error } = await supabase.rpc("review_source_item", {
    p_source_item_id: sourceItemId,
    p_decision: decision,
    p_reason: reason,
  });
  if (error) redirect(alphaPath(error.message));
  refreshAlpha();
  redirect(alphaPath());
}

export async function promoteSourceItemAction(formData: FormData) {
  const { supabase } = await requireStaff();
  const sourceItemId = value(formData, "sourceItemId");
  const categorySlug = value(formData, "categorySlug") || null;
  const contentType = value(formData, "contentType") || "video";
  const hostingMode = value(formData, "hostingMode") || "self_host_open";
  const { data, error } = await supabase.rpc("promote_source_item_to_draft", {
    p_source_item_id: sourceItemId,
    p_category_slug: categorySlug,
    p_content_type: contentType,
    p_hosting_mode: hostingMode,
  });
  if (error || !data) redirect(alphaPath(error?.message ?? "Source candidate could not be promoted."));
  refreshAlpha();
  redirect(`/studio/content/${data}`);
}
