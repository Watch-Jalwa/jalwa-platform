export function isCatalogueContentId(value: unknown): value is string;
export function youtubePosterUrl(videoId: string | null | undefined): string | null;
export function cataloguePosterPath(contentId: string | null | undefined): string | null;

export type CataloguePosterRef =
  | { kind: "redirect"; url: string }
  | { kind: "object"; key: string };

export function resolveCataloguePoster(contentId: string): Promise<CataloguePosterRef | null>;

export function withCataloguePosterFallback<T extends {
  id?: string;
  thumbnailUrl?: string | null;
  contentType?: string;
}>(item: T): T;
