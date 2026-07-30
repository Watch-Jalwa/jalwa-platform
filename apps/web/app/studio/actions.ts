"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { canonicalYouTubeUrl, parseYouTubeVideoId } from "@/lib/youtube/parse.mjs";
import { requireStaff } from "@/lib/studio/auth";

function value(formData: FormData, key: string) {
  const item = formData.get(key);
  return typeof item === "string" ? item.trim() : "";
}

function safeSlug(title: string) {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60);
  return `${slug || "content"}-${crypto.randomUUID().slice(0, 6)}`;
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

export async function submitRightsReviewAction(formData: FormData) {
  const { supabase, user } = await requireStaff();
  const id = value(formData, "id");
  await supabase.from("content_items").update({ status: "rights_review", updated_by: user.id }).eq("id", id).eq("status", "draft");
  revalidatePath(`/studio/content/${id}`);
}

export async function approveRightsAction(formData: FormData) {
  const { supabase, user, profile } = await requireStaff();
  if (profile.role !== "rights_reviewer" && profile.role !== "admin") redirect("/studio");
  const id = value(formData, "id");
  const rightsId = value(formData, "rightsId");
  const { error } = await supabase.from("rights_records").update({ status: "approved", embedding_confirmed: true, verified_by: user.id, verified_at: new Date().toISOString() }).eq("id", rightsId).eq("content_id", id);
  if (!error) await supabase.from("content_items").update({ status: "editorial_review", updated_by: user.id }).eq("id", id);
  revalidatePath(`/studio/content/${id}`);
}

export async function publishContentAction(formData: FormData) {
  const { supabase, user } = await requireStaff();
  const id = value(formData, "id");
  await supabase.from("content_items").update({ status: "published", publish_at: new Date().toISOString(), updated_by: user.id }).eq("id", id);
  revalidatePath(`/studio/content/${id}`);
  revalidatePath("/");
  revalidatePath("/explore");
}
