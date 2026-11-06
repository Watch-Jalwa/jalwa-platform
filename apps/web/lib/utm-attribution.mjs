const STORAGE_KEY = "jalwa_utm_attribution";
const MSISDN_KEY = "jalwa_landing_msisdn";
const TTL_MS = 30 * 24 * 60 * 60 * 1000;

function canUseStorage() {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

export function stampUtmAttribution(attribution) {
  if (!canUseStorage()) return;
  const payload = {
    ...attribution,
    stampedAt: Date.now(),
    expiresAt: Date.now() + TTL_MS,
  };
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

export function readUtmAttribution() {
  if (!canUseStorage()) return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.expiresAt || parsed.expiresAt < Date.now()) {
      window.localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function rememberLandingMsisdn(msisdn) {
  if (typeof window === "undefined" || typeof window.sessionStorage === "undefined") return;
  window.sessionStorage.setItem(MSISDN_KEY, String(msisdn ?? "").replace(/\D/g, "").slice(0, 15));
}

export function readLandingMsisdn() {
  if (typeof window === "undefined" || typeof window.sessionStorage === "undefined") return "";
  return window.sessionStorage.getItem(MSISDN_KEY) ?? "";
}
