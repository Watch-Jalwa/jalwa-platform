import { getActiveViewerProfile } from "@/lib/customer/active-profile";
import { featuredContent } from "@/lib/catalogue/demo-data";
import type { CatalogueItem } from "@/lib/catalogue/types";
import { canUseDemoData, hasBackendConfiguration } from "@/lib/runtime";
import { createClient } from "@/lib/database/server";

export type RecommendedItem = CatalogueItem & { recommendationReason?: string; recommendationScore?: number };

function mapRow(row: Record<string, unknown>): RecommendedItem {
  return {
    id: typeof row.id === "string" ? row.id : undefined,
    slug: typeof row.slug === "string" ? row.slug : "unavailable",
    title: typeof row.title === "string" ? row.title : "Untitled",
    titleUrdu: typeof row.title_ur === "string" ? row.title_ur : null,
    description: typeof row.description === "string" ? row.description : null,
    category: typeof row.category_name === "string" ? row.category_name : "Jalwa",
    categorySlug: typeof row.category_slug === "string" ? row.category_slug : "all",
    durationSeconds: typeof row.duration_seconds === "number" ? row.duration_seconds : null,
    accessLevel: (typeof row.access_level === "string" ? row.access_level : "public") as CatalogueItem["accessLevel"],
    contentType: (typeof row.content_type === "string" ? row.content_type : "video") as CatalogueItem["contentType"],
    hostingMode: (typeof row.hosting_mode === "string" ? row.hosting_mode : "external_link") as CatalogueItem["hostingMode"],
    thumbnailUrl: typeof row.thumbnail_url === "string" ? row.thumbnail_url : null,
    recommendationReason: typeof row.recommendation_reason === "string" ? row.recommendation_reason : undefined,
    recommendationScore: typeof row.recommendation_score === "number" ? row.recommendation_score : undefined,
  };
}

function demoRecommendations(limit: number, contextSlug?: string | null): RecommendedItem[] {
  return featuredContent.filter((item) => item.slug !== contextSlug).slice(0, limit).map((item, index) => ({
    ...item,
    recommendationReason: index < 2 ? "Popular with Jalwa viewers" : "Fresh on Jalwa",
    recommendationScore: 10 - index,
  }));
}

function recommendationFailure(error: unknown): never {
  console.error("recommendations_load_failed", error);
  throw new Error("Jalwa recommendations are temporarily unavailable.");
}

export async function getRecommendations({ limit = 24, contextContentId = null, contextSlug = null }: { limit?: number; contextContentId?: string | null; contextSlug?: string | null } = {}): Promise<RecommendedItem[]> {
  if (canUseDemoData()) return demoRecommendations(limit, contextSlug);
  if (!hasBackendConfiguration()) return recommendationFailure(new Error("Database backend is not configured."));
  try {
    const database = await createClient();
    const { data: { user } } = await database.auth.getUser();
    if (!user) {
      const { data, error } = await database.rpc("search_catalogue", { p_query: null, p_category: null, p_limit: limit });
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map((row) => ({ ...mapRow(row), recommendationReason: "Trending on Jalwa" }));
    }
    const profile = await getActiveViewerProfile(user.id);
    if (!profile) {
      const { data, error } = await database.rpc("search_catalogue", { p_query: null, p_category: null, p_limit: limit });
      if (error) throw error;
      return ((data ?? []) as Record<string, unknown>[]).map((row) => ({ ...mapRow(row), recommendationReason: "Popular on Jalwa" }));
    }
    const { data, error } = await database.rpc("get_recommendations", { p_viewer_profile_id: profile.id, p_limit: limit, p_context_content_id: contextContentId });
    if (error) throw error;
    return ((data ?? []) as Record<string, unknown>[]).map(mapRow);
  } catch (error) {
    if (canUseDemoData()) return demoRecommendations(limit, contextSlug);
    return recommendationFailure(error);
  }
}
