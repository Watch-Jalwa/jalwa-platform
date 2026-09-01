function safeRelativeUri(uri) {
  const value = uri.trim();
  if (!value || value.startsWith("data:")) return value;
  if (/^[a-z][a-z0-9+.-]*:/i.test(value) || value.startsWith("//") || value.startsWith("/")) {
    throw new Error("HLS playlist contains a non-relative media URI.");
  }
  return value;
}

export function normalizeMediaPath(parts) {
  if (!Array.isArray(parts) || parts.length === 0) return null;
  const cleaned = [];
  for (const part of parts) {
    if (typeof part !== "string" || !part || part === "." || part === ".." || part.includes("\\") || part.includes("\0")) return null;
    cleaned.push(part);
  }
  const key = cleaned.join("/");
  if (!key.startsWith("processed/") || key.includes("//")) return null;
  return key;
}

export function mediaPathAllowed(key, pathPrefix) {
  return typeof key === "string"
    && typeof pathPrefix === "string"
    && pathPrefix.startsWith("processed/")
    && pathPrefix.endsWith("/")
    && key.startsWith(pathPrefix);
}

function withToken(uri, token) {
  const safe = safeRelativeUri(uri);
  if (!safe || safe.startsWith("data:")) return safe;
  const separator = safe.includes("?") ? "&" : "?";
  return `${safe}${separator}token=${encodeURIComponent(token)}`;
}

export function rewriteHlsPlaylist(playlist, token) {
  if (typeof playlist !== "string" || typeof token !== "string" || !token) throw new Error("Playlist and token are required.");
  return playlist.split(/\r?\n/).map((line) => {
    if (!line) return line;
    if (!line.startsWith("#")) return withToken(line, token);
    return line.replace(/URI="([^"]+)"/g, (_match, uri) => `URI="${withToken(uri, token)}"`);
  }).join("\n");
}
