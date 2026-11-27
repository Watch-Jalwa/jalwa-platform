export const DIGISPHERE_PENDING_KEY: string;

export function saveDigispherePendingCheckout(pending: {
  requestId?: string;
  checkoutMode?: string;
  planCode?: string;
  landing?: string;
  utm?: string;
  parameter?: string;
}): void;

export function readDigispherePendingCheckout(): {
  requestId?: string;
  checkoutMode?: string;
  planCode?: string;
  landing?: string;
  utm?: string;
  parameter?: string;
  startedAt?: number;
} | null;

export function clearDigispherePendingCheckout(): void;

export function resolveDigisphereOrderId(
  query?: Record<string, string | undefined | null>,
  pending?: { requestId?: string } | null,
): string;

export function fireDigisphereSubscribeFromReturn(
  searchParams: URLSearchParams | Record<string, string | undefined | null>,
): { fired: boolean; reason?: string; orderId?: string };
