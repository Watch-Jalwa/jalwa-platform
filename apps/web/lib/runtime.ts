export function isFrontendPreview() {
  return process.env.NEXT_PUBLIC_FRONTEND_PREVIEW === "true" || process.env.VERCEL_ENV === "preview";
}

export function canUseDemoData() {
  return isFrontendPreview();
}

export function hasBackendConfiguration() {
  return Boolean(process.env.DATABASE_URL && process.env.BETTER_AUTH_SECRET && (process.env.BETTER_AUTH_URL || process.env.NEXT_PUBLIC_APP_URL));
}

export function safeInternalPath(value: string | null | undefined, fallback = "/") {
  if (!value || !value.startsWith("/") || value.startsWith("//")) return fallback;
  try {
    const url = new URL(value, "http://jalwa.local");
    if (url.origin !== "http://jalwa.local") return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch { return fallback; }
}
