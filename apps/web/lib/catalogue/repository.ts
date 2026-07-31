import { createClient } from "@/lib/supabase/server";
import { canUseDemoData, hasSupabaseConfig } from "@/lib/runtime";
import { categories as demoCategories, featuredContent } from "./demo-data";
import type { CatalogueCategory, CatalogueItem, PlaybackSource } from "./types";

function asString(value: unknown) { return typeof value === "string" ? value : null; }
function asNumber(value: unknown) { return typeof value === "number" ? value : null; }
function mapSearchRow(row: Record<string, unknown>): CatalogueItem {
  return {
    id: asString(row.id) ?? undefined,
    slug: asString(row.slug) ?? "unavailable",
    title: asString(row.title) ?? "Untitled",
    titleUrdu: asString(row.title_ur),
    description: asString(row.description),
    category: asString(row.category_name) ?? "Jalwa",
    categorySlug: asString(row.category_slug) ?? "all",
    durationSeconds: asNumber(row.duration_seconds),
    accessLevel: (asString(row.access_level) ?? "public") as CatalogueItem["accessLevel"],
    contentType: (asString(row.content_type) ?? "video") as CatalogueItem["contentType"],
    hostingMode: (asString(row.hosting_mode) ?? "external_link") as CatalogueItem["hostingMode"],
    thumbnailUrl: asString(row.thumbnail_url),
  };
}

function requireDatabase() {
  if (!hasSupabaseConfig()) throw new Error("Catalogue database is not configured.");
}

function catalogueFailure(scope: string, error: unknown): never {
  console.error(`catalogue_${scope}_failed`, error);
  throw new Error("Jalwa catalogue is temporarily unavailable.");
}

export async function getCategories(): Promise<CatalogueCategory[]> {
  if (canUseDemoData()) return demoCategories;
  requireDatabase();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("categories").select("slug,name_en,name_ur,name_roman_ur,icon").eq("is_active", true).order("sort_order");
    if (error) throw error;
    return (data ?? []).map((row) => ({ slug: row.slug, label: row.name_en, urdu: row.name_ur, romanUrdu: row.name_roman_ur, icon: row.icon }));
  } catch (error) {
    if (canUseDemoData()) return demoCategories;
    return catalogueFailure("categories", error);
  }
}

export async function searchCatalogue(input: { query?: string; category?: string; limit?: number } = {}): Promise<CatalogueItem[]> {
  const query = input.query?.trim() ?? "";
  const category = input.category?.trim() ?? "";
  if (canUseDemoData()) {
    return featuredContent.filter((item) => {
      const categoryMatches = !category || item.categorySlug === category;
      const haystack = `${item.title} ${item.titleUrdu ?? ""} ${item.description ?? ""}`.toLowerCase();
      return categoryMatches && (!query || haystack.includes(query.toLowerCase()));
    });
  }
  requireDatabase();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("search_catalogue", { p_query: query || null, p_category: category || null, p_limit: input.limit ?? 40 });
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(mapSearchRow);
  } catch (error) {
    if (canUseDemoData()) return featuredContent;
    return catalogueFailure("search", error);
  }
}

export async function getContentBySlug(slug: string): Promise<CatalogueItem | null> {
  if (canUseDemoData()) return featuredContent.find((item) => item.slug === slug) ?? null;
  requireDatabase();
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("content_items")
      .select("id,slug,title_en,title_ur,description_en,content_type,hosting_mode,access_level,duration_seconds,thumbnail_url,primary_category_id")
      .eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!data) return null;

    const [categoryResult, playbackResult, rightsResult] = await Promise.all([
      data.primary_category_id
        ? supabase.from("categories").select("slug,name_en").eq("id", data.primary_category_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      supabase.from("playback_sources").select("provider,provider_content_id,embed_url,media_url,external_url,media_asset_id,drm_asset_id,format")
        .eq("content_id", data.id).eq("is_primary", true).maybeSingle(),
      supabase.from("rights_records").select("source_url,attribution_text")
        .eq("content_id", data.id).eq("status", "approved").maybeSingle(),
    ]);
    if (categoryResult.error) throw categoryResult.error;
    if (playbackResult.error) throw playbackResult.error;
    if (rightsResult.error) throw rightsResult.error;

    const category = categoryResult.data;
    const playback = playbackResult.data;
    const rights = rightsResult.data;
    const source: PlaybackSource | null = playback ? {
      provider: playback.provider,
      providerContentId: playback.provider_content_id,
      embedUrl: playback.embed_url,
      mediaUrl: playback.media_url,
      externalUrl: playback.external_url,
      mediaAssetId: playback.media_asset_id,
      drmAssetId: playback.drm_asset_id,
      format: playback.format as PlaybackSource["format"],
    } : null;
    return {
      id: data.id,
      slug: data.slug,
      title: data.title_en,
      titleUrdu: data.title_ur,
      description: data.description_en,
      category: category?.name_en ?? "Jalwa",
      categorySlug: category?.slug ?? "all",
      durationSeconds: data.duration_seconds,
      accessLevel: data.access_level,
      contentType: data.content_type,
      hostingMode: data.hosting_mode,
      thumbnailUrl: data.thumbnail_url,
      playback: source,
      sourceUrl: rights?.source_url ?? source?.externalUrl,
      attribution: rights?.attribution_text,
    };
  } catch (error) {
    if (canUseDemoData()) return featuredContent.find((item) => item.slug === slug) ?? null;
    return catalogueFailure("content", error);
  }
}
