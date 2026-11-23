/**
 * Browser-safe public origin for redirects.
 * Docker / Next often bind to 0.0.0.0 — never emit that as a redirect host.
 */
export function publicAppOrigin(requestUrl) {
  const candidates = [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.APP_URL,
    process.env.BETTER_AUTH_URL,
  ];
  for (const raw of candidates) {
    const value = String(raw ?? "").trim();
    if (!value) continue;
    try {
      const url = new URL(value);
      if (url.hostname === "0.0.0.0") {
        url.hostname = "localhost";
      }
      return url.origin;
    } catch {
      // try next candidate
    }
  }

  const fallback = new URL(requestUrl);
  if (fallback.hostname === "0.0.0.0") fallback.hostname = "localhost";
  return fallback.origin;
}
