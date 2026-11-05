export function jazzcashV11Configured(): boolean;
export function jazzcashReturnUrl(): string;
export function jazzcashActionUrl(): string;
export function buildJazzcashSecureHash(fields: Record<string, string>, integritySalt?: string): string;
export function verifyJazzcashSecureHash(fields: Record<string, string>): boolean;
export function buildLinkWalletForm(input: {
  requestId: string;
  msisdn: string;
}): { requestId: string; actionUrl: string; fields: Record<string, string> };
export const JAZZCASH_REQUEST_ID_MAX: number;
export function isValidJazzcashRequestId(value: unknown): boolean;
export function newJazzcashRequestId(): string;
export function newJazzcashAlphanumericId(): string;
export function jazzcashOfficialTestVectorHash(): string;
