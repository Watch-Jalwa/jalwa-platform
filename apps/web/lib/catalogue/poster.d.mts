export function isCatalogueContentId(value: unknown): value is string;
export function youtubePosterUrl(videoId: string | null | undefined): string | null;
export function cataloguePosterPath(contentId: string | null | undefined): string | null;
export function curatedPosterUrlForSlug(slug: string | null | undefined): string | null;
export function buildGeneratedPosterSvg(input?: {
  id?: string;
  slug?: string | null;
  title?: string;
  category?: string | null;
  contentType?: string | null;
  durationSeconds?: number | null;
}): string;

export type CataloguePosterRef =
  | { kind: "redirect"; url: string }
  | {
      kind: "generated";
      id: string;
      slug?: string | null;
      title: string;
      category?: string | null;
      contentType?: string | null;
      durationSeconds?: number | null;
    };

export function resolveCataloguePoster(contentId: string): Promise<CataloguePosterRef | null>;

export function withCataloguePosterFallback<T extends {
  id?: string;
  thumbnailUrl?: string | null;
  contentType?: string;
}>(item: T): T;
