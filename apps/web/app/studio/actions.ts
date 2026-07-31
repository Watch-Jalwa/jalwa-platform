"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/studio/auth";
import { canonicalYouTubeUrl, parseYouTubeVideoId } from "@/lib/youtube/parse.mjs";

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item.trim() : "";
}

function checked(formData: FormData, key: string) {
  return formData.get(key) === "on";
}

function optionalExpiry(formData: FormData) {
  const raw = value(formData, "expiresAt");
  if (!raw) return null;
  const parsed = new Date(`${raw}T23:59:59.999Z`);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

function safeSlug(title: string) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return `${slug || "content"}-${crypto.randomUUID().slice(0, 6)}`;
}

function contentPath(id: string, error?: string) {
  return error ? `/studio/content/${id}?error=${encodeURIComponent(error)}` : `/studio/content/${id}`;
}

async function recordAudit(
  supabase: Awaited<ReturnType<typeof requireStaff>>["supabase"],
  actorId: string,
  action: string,
  entityId: string,
  metadata: Record<string, unknown> = {},
) {
  await supabase.from("audit_logs").insert({
    actor_id: actorId,
    action,
    entity_type: "content_item",
    entity_id: entityId,
    metadata,
  });
}

async function primaryPlaybackId(supabase: Awaited<ReturnType<typeof requireStaff>>["supabase"], contentId: string) {
  const { data, error } = await supabase.from("playback_sources").select("id").eq("content_id", contentId).eq("is_primary", true).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
}

export async function importYouTubeAction(formData: FormData) {
  const { supabase } = await requireStaff();
  const rawUrl = value(formData, "url");
  const videoId = parseYouTubeVideoId(rawUrl);
  if (!videoId) redirect(`/studio/content/new?error=${encodeURIComponent("Enter a valid YouTube video URL.")}`);
  const canonicalUrl = canonicalYouTubeUrl(videoId);
  let metadata: { title: string; thumbnail_url?: string };
  try {
    const response = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(canonicalUrl)}&format=json`, {
      signal: AbortSignal.timeout(8000),
      cache: "no-store",
    });
    if (!response.ok) throw new Error("Video metadata unavailable");
    metadata = (await response.json()) as { title: string; thumbnail_url?: string };
  } catch {
    redirect(`/studio/content/new?error=${encodeURIComponent("YouTube metadata could not be retrieved. Confirm the video is public and embeddable.")}`);
  }
  const { data, error } = await supabase.rpc("import_youtube_draft", {
    p_video_id: videoId,
    p_source_url: canonicalUrl,
    p_title: metadata.title,
    p_thumbnail_url: metadata.thumbnail_url ?? null,
    p_category_slug: value(formData, "category") || null,
  });
  if (error || !data) redirect(`/studio/content/new?error=${encodeURIComponent(error?.message ?? "Import failed.")}`);
  revalidatePath("/studio/content");
  redirect(`/studio/content/${data}`);
}

export async function createContentDraftAction(formData: FormData) {
  const { supabase, user } = await requireStaff();
  const title = value(formData, "title");
  const categorySlug = value(formData, "category");
  if (!title) redirect(`/studio/content/new?error=${encodeURIComponent("Title is required.")}`);
  const { data: category } = await supabase.from("categories").select("id").eq("slug", categorySlug).maybeSingle();
  const { data, error } = await supabase.from("content_items").insert({
    slug: safeSlug(title),
    title_en: title,
    title_ur: value(formData, "titleUrdu") || null,
    content_type: value(formData, "contentType") || "video",
    hosting_mode: value(formData, "hostingMode") || "self_host_owned",
    access_level: "public",
    status: "draft",
    primary_category_id: category?.id ?? null,
    created_by: user.id,
    updated_by: user.id,
  }).select("id").single();
  if (error || !data) redirect(`/studio/content/new?error=${encodeURIComponent(error?.message ?? "Draft creation failed.")}`);
  await supabase.from("rights_records").insert({
    content_id: data.id,
    source_url: `jalwa://content/${data.id}`,
    creator: "Jalwa",
    commercial_use_confirmed: false,
    modification_confirmed: false,
    self_hosting_confirmed: false,
    embedding_confirmed: false,
    attribution_text: "Jalwa production — rights approval pending.",
    status: "pending",
  });
  revalidatePath("/studio/content");
  redirect(`/studio/content/${data.id}`);
}

export async function updateRightsAction(formData: FormData) {
  const { supabase, user } = await requireStaff();
  const id = value(formData, "id");
  const rightsId = value(formData, "rightsId");
  const { error } = await supabase.from("rights_records").update({
    source_url: value(formData, "sourceUrl"),
    creator: value(formData, "creator") || null,
    licence_code: value(formData, "licenceCode") || null,
    attribution_text: value(formData, "attributionText") || null,
    evidence_url: value(formData, "evidenceUrl") || null,
    evidence_note: value(formData, "evidenceNote") || null,
    takedown_contact: value(formData, "takedownContact") || null,
    expires_at: optionalExpiry(formData),
    review_notes: value(formData, "reviewNotes") || null,
    commercial_use_confirmed: checked(formData, "commercialUseConfirmed"),
    modification_confirmed: checked(formData, "modificationConfirmed"),
    self_hosting_confirmed: checked(formData, "selfHostingConfirmed"),
    embedding_confirmed: checked(formData, "embeddingConfirmed"),
    status: "pending",
    verified_by: null,
    verified_at: null,
  }).eq("id", rightsId).eq("content_id", id);
  if (error) redirect(contentPath(id, error.message));
  try {
    const playbackId = await primaryPlaybackId(supabase, id);
    if (playbackId) await supabase.from("live_source_configs").update({ enabled: false, rights_verified_at: null, next_review_at: null }).eq("playback_source_id", playbackId);
  } catch (liveError) {
    console.error("live_source_rights_reset_failed", liveError);
  }
  await recordAudit(supabase, user.id, "rights_record_updated", id, { rights_id: rightsId });
  revalidatePath(contentPath(id));
  revalidatePath("/studio/content");
  redirect(contentPath(id));
}

export async function submitRightsReviewAction(formData: FormData) {
  const { supabase, user } = await requireStaff();
  const id = value(formData, "id");
  const { error } = await supabase.from("content_items").update({ status: "rights_review", updated_by: user.id }).eq("id", id).in("status", ["draft", "unavailable"]);
  if (error) redirect(contentPath(id, error.message));
  await recordAudit(supabase, user.id, "rights_review_requested", id);
  revalidatePath(contentPath(id));
  revalidatePath("/studio/content");
}

export async function approveRightsAction(formData: FormData) {
  const { supabase, user, profile } = await requireStaff();
  if (profile.role !== "rights_reviewer" && profile.role !== "admin") redirect("/studio");
  const id = value(formData, "id");
  const rightsId = value(formData, "rightsId");
  const verifiedAt = new Date();
  const nextReviewAt = new Date(verifiedAt);
  nextReviewAt.setUTCDate(nextReviewAt.getUTCDate() + 90);
  const { error } = await supabase.from("rights_records").update({
    status: "approved",
    verified_by: user.id,
    verified_at: verifiedAt.toISOString(),
  }).eq("id", rightsId).eq("content_id", id);
  if (error) redirect(contentPath(id, error.message));
  try {
    const playbackId = await primaryPlaybackId(supabase, id);
    if (playbackId) {
      const { error: liveError } = await supabase.from("live_source_configs").update({
        enabled: false,
        rights_verified_at: verifiedAt.toISOString(),
        next_review_at: nextReviewAt.toISOString(),
      }).eq("playback_source_id", playbackId);
      if (liveError) throw liveError;
    }
  } catch (liveError) {
    redirect(contentPath(id, liveError instanceof Error ? liveError.message : "Live source review could not be recorded."));
  }
  const { error: contentError } = await supabase.from("content_items").update({ status: "editorial_review", updated_by: user.id }).eq("id", id);
  if (contentError) redirect(contentPath(id, contentError.message));
  await recordAudit(supabase, user.id, "rights_approved", id, { rights_id: rightsId, live_source_review_days: 90 });
  revalidatePath(contentPath(id));
  revalidatePath("/studio/content");
}

export async function setLiveSourceEnabledAction(formData: FormData) {
  const { supabase, user, profile } = await requireStaff();
  if (profile.role !== "rights_reviewer" && profile.role !== "admin") redirect("/studio");
  const id = value(formData, "id");
  const enabled = value(formData, "enabled") === "true";
  const playbackId = await primaryPlaybackId(supabase, id);
  if (!playbackId) redirect(contentPath(id, "Primary playback source unavailable."));
  const [{ data: rights }, { data: config }] = await Promise.all([
    supabase.from("rights_records").select("status").eq("content_id", id).maybeSingle(),
    supabase.from("live_source_configs").select("next_review_at,rights_verified_at").eq("playback_source_id", playbackId).maybeSingle(),
  ]);
  if (!config) redirect(contentPath(id, "Live source configuration unavailable."));
  if (enabled) {
    if (rights?.status !== "approved") redirect(contentPath(id, "Approved rights are required before enabling a live source."));
    const reviewAt = config.next_review_at ? new Date(config.next_review_at) : null;
    if (!config.rights_verified_at || !reviewAt || reviewAt.getTime() <= Date.now()) redirect(contentPath(id, "Current live-source terms review is required."));
  }
  const { error } = await supabase.from("live_source_configs").update({ enabled }).eq("playback_source_id", playbackId);
  if (error) redirect(contentPath(id, error.message));
  await recordAudit(supabase, user.id, enabled ? "live_source_enabled" : "live_source_disabled", id, { playback_source_id: playbackId });
  revalidatePath(contentPath(id));
  revalidatePath("/live");
  revalidatePath("/explore");
  redirect(contentPath(id));
}

export async function publishContentAction(formData: FormData) {
  const { supabase, user } = await requireStaff();
  const id = value(formData, "id");
  const { error } = await supabase.from("content_items").update({
    status: "published",
    publish_at: new Date().toISOString(),
    unpublish_at: null,
    updated_by: user.id,
  }).eq("id", id);
  if (error) redirect(contentPath(id, error.message));
  await recordAudit(supabase, user.id, "content_published", id);
  revalidatePath(contentPath(id));
  revalidatePath("/studio/content");
  revalidatePath("/");
  revalidatePath("/explore");
  revalidatePath("/live");
}

export async function unpublishContentAction(formData: FormData) {
  const { supabase, user } = await requireStaff();
  const id = value(formData, "id");
  const reason = value(formData, "reason") || "Manual operational takedown";
  const { error } = await supabase.from("content_items").update({
    status: "unavailable",
    unpublish_at: new Date().toISOString(),
    updated_by: user.id,
  }).eq("id", id);
  if (error) redirect(contentPath(id, error.message));
  try {
    const playbackId = await primaryPlaybackId(supabase, id);
    if (playbackId) await supabase.from("live_source_configs").update({ enabled: false }).eq("playback_source_id", playbackId);
  } catch (liveError) {
    console.error("live_source_kill_switch_failed", liveError);
  }
  await recordAudit(supabase, user.id, "content_unpublished", id, { reason });
  revalidatePath(contentPath(id));
  revalidatePath("/studio/content");
  revalidatePath("/");
  revalidatePath("/explore");
  revalidatePath("/live");
}
