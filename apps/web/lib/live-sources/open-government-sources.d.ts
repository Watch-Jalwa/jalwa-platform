import type { LiveSourceDefinition } from "./registry";

export type OpenGovernmentLiveSourceDefinition = LiveSourceDefinition & {
  imagePathPattern?: string;
};

export declare const OPEN_GOVERNMENT_LIVE_SOURCES: Record<string, OpenGovernmentLiveSourceDefinition>;
export declare const OPEN_GOVERNMENT_TOP_LEVEL_KEYS: string[];
