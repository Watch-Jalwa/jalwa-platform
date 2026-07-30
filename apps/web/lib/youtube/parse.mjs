const ID_PATTERN = /^[A-Za-z0-9_-]{11}$/;
const ALLOWED_HOSTS = new Set(["youtube.com", "www.youtube.com", "m.youtube.com", "youtu.be"]);

export function parseYouTubeVideoId(value) {
  if (ID_PATTERN.test(value)) return value;
  let url;
  try {
    url = new URL(value);
  } catch {
    return null;
  }
  if (!ALLOWED_HOSTS.has(url.hostname.toLowerCase())) return null;
  if (url.hostname.toLowerCase() === "youtu.be") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    return id && ID_PATTERN.test(id) ? id : null;
  }
  const queryId = url.searchParams.get("v");
  if (queryId && ID_PATTERN.test(queryId)) return queryId;
  const parts = url.pathname.split("/").filter(Boolean);
  const markerIndex = parts.findIndex((part) => part === "embed" || part === "shorts" || part === "live");
  const pathId = markerIndex >= 0 ? parts[markerIndex + 1] : null;
  return pathId && ID_PATTERN.test(pathId) ? pathId : null;
}

export function canonicalYouTubeUrl(videoId) {
  if (!ID_PATTERN.test(videoId)) throw new Error("Invalid YouTube video id");
  return `https://www.youtube.com/watch?v=${videoId}`;
}
