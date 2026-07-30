import { createClient } from "@/lib/supabase/server";
import { categories as demoCategories, featuredContent } from "./demo-data";
import type { CatalogueCategory, CatalogueItem, PlaybackSource } from "./types";

function hasDatabaseConfiguration() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
}

function asString(value: unknown) {
  return typeof value === "string" ? value : null;
}

function asNumber(value: unknown) {
  return typeof value === "number" ? value : null;
}

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

export async function getCategories(): Promise<CatalogueCategory[]> {
  if (!hasDatabaseConfiguration()) return demoCategories;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("categories")
      .select("slug,name_en,name_ur,name_roman_ur,icon")
      .eq("is_active", true)
      .order("sort_order");
    if (error) throw error;
    return (data ?? []).map((row) => ({
      slug: row.slug,
      label: row.name_en,
      urdu: row.name_ur,
      romanUrdu: row.name_roman_ur,
      icon: row.icon,
    }));
  } catch {
    return demoCategories;
  }
}

export async function searchCatalogue(input: { query?: string; category?: string; limit?: number } = {}): Promise<CatalogueItem[]> {
  const query = input.query?.trim() ?? "";
  const category = input.category?.trim() ?? "";
  if (!hasDatabaseConfiguration()) {
    return featuredContent.filter((item) => {
      const categoryMatches = !category || item.categorySlug === category;
      const haystack = `${item.title} ${item.titleUrdu ?? ""} ${item.description ?? ""}`.toLowerCase();
      return categoryMatches && (!query || haystack.includes(query.toLowerCase()));
    });
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.rpc("search_catalogue", {
      p_query: query || null,
      p_category: category || null,
      p_limit: input.limit ?? 40,
    });
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(mapSearchRow);
  } catch {
    return featuredContent;
  }
}

export async function getContentBySlug(slug: string): Promise<CatalogueItem | null> {
  if (!hasDatabaseConfiguration()) return featuredContent.find((item) => item.slug === slug) ?? null;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("content_items")
      .select("id,slug,title_en,title_ur,description_en,content_type,hosting_mode,access_level,duration_seconds,thumbnail_url,primary_category_id")
      .eq("slug", slug)
      .single();
    if (error || !data) return null;

    const [{ data: category }, { data: playback }, { data: rights }] = await Promise.all([
      data.primary_category_id
        ? supabase.from("categories").select("slug,name_en").eq("id", data.primary_category_id).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from("playback_sources").select("provider,provider_content_id,embed_url,media_url,external_url").eq("content_id", data.id).eq("is_primary", true).maybeSingle(),
      supabase.from("rights_records").select("source_url,attribution_text").eq("content_id", data.id).eq("status", "approved").maybeSingle(),
    ]);

    const source: PlaybackSource | null = playback
      ? {
          provider: playback.provider,
          providerContentId: playback.provider_content_id,
          embedUrl: playback.embed_url,
          mediaUrl: playback.media_url,
          externalUrl: playback.external_url,
        }
      : null;

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
  } catch {
    return featuredContent.find((item) => item.slug === slug) ?? null;
  }
}
