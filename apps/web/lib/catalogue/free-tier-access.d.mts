import type { CatalogueItem, ContentType } from "./types";

export const FREE_UNLOCKED_VIDEO_LIMIT: 10;
export function isGatedVideoType(contentType: ContentType | string): boolean;

export type ViewerVideoAccess = {
  signedIn: boolean;
  premium: boolean;
  freeUnlockedIds: Set<string>;
};

export function getViewerVideoAccess(): Promise<ViewerVideoAccess>;
export function canPlayVideoContent(
  access: ViewerVideoAccess,
  input: { contentId?: string | null; contentType: ContentType | string },
): boolean;
export function annotateCatalogueAccess(items: CatalogueItem[]): Promise<CatalogueItem[]>;
