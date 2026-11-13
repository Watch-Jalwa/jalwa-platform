export const TEMPORARILY_HIDDEN_CONTENT_SLUGS: readonly string[];
export function isTemporarilyHiddenSlug(slug: unknown): boolean;
export function filterVisibleCatalogueItems<T extends { slug?: string | null }>(items: T[] | null | undefined): T[];
