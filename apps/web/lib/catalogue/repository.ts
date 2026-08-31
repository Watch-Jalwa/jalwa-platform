import { liveSourcesEnabled } from "@/lib/live-sources/registry";
import { canUseDemoData, hasBackendConfiguration } from "@/lib/runtime";
import { createClient } from "@/lib/database/server";
import { categories as demoCategories, featuredContent } from "./demo-data";
import type { CatalogueCategory, CatalogueItem, LiveCatalogueCollection, PlaybackSource } from "./types";

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
  if (!hasBackendConfiguration()) throw new Error("Catalogue database is not configured.");
}

function catalogueFailure(scope: string, error: unknown): never {
  console.error(`catalogue_${scope}_failed`, error);
  throw new Error("Jalwa catalogue is temporarily unavailable.");
}

export async function getCategories(): Promise<CatalogueCategory[]> {
  if (canUseDemoData()) return demoCategories;
  requireDatabase();
  try {
    const database = await createClient();
    const { data, error } = await database.from("categories").select("slug,name_en,name_ur,name_roman_ur,icon").eq("is_active", true).order("sort_order");
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
    const database = await createClient();
    const { data, error } = await database.rpc("search_catalogue", { p_query: query || null, p_category: category || null, p_limit: input.limit ?? 40 });
    if (error) throw error;
    const items = ((data ?? []) as Record<string, unknown>[]).map(mapSearchRow);
    return liveSourcesEnabled() ? items : items.filter((item) => item.contentType !== "live");
  } catch (error) {
    if (canUseDemoData()) return featuredContent;
    return catalogueFailure("search", error);
  }
}

export async function getContentBySlug(slug: string): Promise<CatalogueItem | null> {
  if (canUseDemoData()) return featuredContent.find((item) => item.slug === slug) ?? null;
  requireDatabase();
  try {
    const database = await createClient();
    const { data, error } = await database.from("content_items")
      .select("id,slug,title_en,title_ur,description_en,content_type,hosting_mode,access_level,duration_seconds,thumbnail_url,primary_category_id")
      .eq("slug", slug).maybeSingle();
    if (error) throw error;
    if (!data) return null;
    if (data.content_type === "live" && !liveSourcesEnabled()) return null;

    const [categoryResult, playbackResult, rightsResult] = await Promise.all([
      data.primary_category_id
        ? database.from("categories").select("slug,name_en").eq("id", data.primary_category_id).maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      database.from("playback_sources").select("id,provider,provider_content_id,embed_url,media_url,external_url,media_asset_id,drm_asset_id,format")
        .eq("content_id", data.id).eq("is_primary", true).maybeSingle(),
      database.from("rights_records").select("source_url,attribution_text")
        .eq("content_id", data.id).eq("status", "approved").maybeSingle(),
    ]);
    if (categoryResult.error) throw categoryResult.error;
    if (playbackResult.error) throw playbackResult.error;
    if (rightsResult.error) throw rightsResult.error;

    const category = categoryResult.data;
    const playback = playbackResult.data;
    const rights = rightsResult.data;
    let liveConfig: Record<string, unknown> | null = null;
    let liveHealth: Record<string, unknown> | null = null;
    if (data.content_type === "live" && playback?.id) {
      const [configResult, healthResult] = await Promise.all([
        database.from("live_source_configs")
          .select("source_key,delivery_adapter,official_source_url,terms_url,required_attribution,refresh_interval_seconds,enabled,next_review_at")
          .eq("playback_source_id", playback.id).maybeSingle(),
        database.from("playback_source_health")
          .select("status,availability,checked_at,last_success_at,source_timestamp,message,availability_reason")
          .eq("playback_source_id", playback.id).maybeSingle(),
      ]);
      if (configResult.error) throw configResult.error;
      if (healthResult.error) throw healthResult.error;
      liveConfig = configResult.data as Record<string, unknown> | null;
      liveHealth = healthResult.data as Record<string, unknown> | null;
      if (!liveConfig || liveConfig.enabled !== true) return null;
      const review = asString(liveConfig.next_review_at);
      if (!review || new Date(review).getTime() <= Date.now()) return null;
    }

    const source: PlaybackSource | null = playback ? {
      provider: playback.provider,
      providerContentId: playback.provider_content_id,
      embedUrl: playback.embed_url,
      mediaUrl: playback.media_url,
      externalUrl: playback.external_url,
      mediaAssetId: playback.media_asset_id,
      drmAssetId: playback.drm_asset_id,
      format: playback.format as PlaybackSource["format"],
      sourceKey: asString(liveConfig?.source_key),
      deliveryAdapter: asString(liveConfig?.delivery_adapter) as PlaybackSource["deliveryAdapter"],
      availability: (asString(liveHealth?.availability) ?? asString(liveHealth?.status) ?? "degraded") as PlaybackSource["availability"],
      availabilityMessage: asString(liveHealth?.availability_reason) ?? asString(liveHealth?.message),
      checkedAt: asString(liveHealth?.checked_at),
      lastSuccessAt: asString(liveHealth?.last_success_at),
      sourceTimestamp: asString(liveHealth?.source_timestamp),
      refreshIntervalSeconds: asNumber(liveConfig?.refresh_interval_seconds),
      officialSourceUrl: asString(liveConfig?.official_source_url),
      termsUrl: asString(liveConfig?.terms_url),
      requiredAttribution: asString(liveConfig?.required_attribution),
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
      sourceUrl: rights?.source_url ?? source?.officialSourceUrl ?? source?.externalUrl,
      attribution: rights?.attribution_text ?? source?.requiredAttribution,
    };
  } catch (error) {
    if (canUseDemoData()) return featuredContent.find((item) => item.slug === slug) ?? null;
    return catalogueFailure("content", error);
  }
}

export async function getLiveCatalogue(): Promise<{ items: CatalogueItem[]; collections: LiveCatalogueCollection[] }> {
  if (!liveSourcesEnabled()) return { items: [], collections: [] };
  requireDatabase();
  try {
    const summaries = await searchCatalogue({ category: "live", limit: 100 });
    const detailed = (await Promise.all(summaries.map((item) => getContentBySlug(item.slug))))
      .filter((item): item is CatalogueItem => Boolean(item));
    const topLevel = detailed.filter((item) => !item.slug.startsWith("usgs-mauna-loa-") && !item.slug.startsWith("usgs-river-") && item.slug !== "usgs-lake-hopatcong");
    const bySlug = new Map(detailed.map((item) => [item.slug, item]));
    const database = await createClient();
    const { data: collectionRows, error: collectionError } = await database.from("collections")
      .select("id,slug,title_en,description_en")
      .in("slug", ["usgs-mauna-loa-live", "usgs-rivers-lakes-live"])
      .eq("status", "published");
    if (collectionError) throw collectionError;
    const ids = (collectionRows ?? []).map((row) => row.id);
    const { data: membershipRows, error: membershipError } = ids.length
      ? await database.from("collection_items").select("collection_id,content_id,sort_order").in("collection_id", ids).order("sort_order")
      : { data: [], error: null };
    if (membershipError) throw membershipError;
    const contentIds = (membershipRows ?? []).map((row) => row.content_id);
    const { data: childRows, error: childError } = contentIds.length
      ? await database.from("content_items").select("id,slug").in("id", contentIds)
      : { data: [], error: null };
    if (childError) throw childError;
    const slugById = new Map((childRows ?? []).map((row) => [row.id, row.slug]));
    const collections = (collectionRows ?? []).map((row) => ({
      slug: row.slug,
      title: row.title_en,
      description: row.description_en,
      items: (membershipRows ?? [])
        .filter((membership) => membership.collection_id === row.id)
        .map((membership) => bySlug.get(slugById.get(membership.content_id) ?? ""))
        .filter((item): item is CatalogueItem => item !== undefined)
        .filter((item) => item.playback?.availability !== "unavailable"),
    })).filter((collection) => collection.items.length > 0);
    return { items: topLevel, collections };
  } catch (error) {
    return catalogueFailure("live", error);
  }
}
