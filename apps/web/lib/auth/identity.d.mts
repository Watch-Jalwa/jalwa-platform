export type IdentityChannel = "email" | "phone";

export type ParsedIdentity =
  | { ok: true; channel: "email"; identity: string; normalized: string }
  | { ok: true; channel: "phone"; identity: string; normalized: string }
  | { ok: false; error: "invalid-identity" | "invalid-email" | "invalid-phone" };

export function normalizePakistaniMobile(raw: string): string | null;
export function parseIdentity(raw: string): ParsedIdentity;
export function maskIdentity(channel: IdentityChannel, normalized: string): string;
export function validateDisplayName(raw: string): string | null;
