export type AccessLevel = "public" | "registered" | "premium" | "internal_preview";
export type ContentType = "video" | "short" | "live" | "audio" | "article" | "image_story" | "quran" | "quiz";
export type HostingMode = "embed_only" | "self_host_open" | "self_host_owned" | "partner_hosted" | "external_link" | "text_database";

export type CatalogueCategory = { slug: string; label: string; urdu?: string | null; romanUrdu?: string | null; icon?: string | null };
export type PlaybackSource = { provider: string; providerContentId?: string | null; embedUrl?: string | null; mediaUrl?: string | null; externalUrl?: string | null; mediaAssetId?: string | null; format?: "youtube" | "mp4" | "hls" | "external" | null };
export type CatalogueItem = { id?: string; slug: string; title: string; titleUrdu?: string | null; description?: string | null; category: string; categorySlug: string; durationSeconds?: number | null; accessLevel: AccessLevel; contentType: ContentType; hostingMode: HostingMode; thumbnailUrl?: string | null; playback?: PlaybackSource | null; sourceUrl?: string | null; attribution?: string | null };
