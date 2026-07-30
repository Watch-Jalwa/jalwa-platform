const VIDEO_MIME_TYPES = new Set(["video/mp4", "video/quicktime", "video/webm", "video/x-matroska"]);
const MAX_UPLOAD_BYTES = 5 * 1024 * 1024 * 1024;

export function validateMediaUpload({ mimeType, sizeBytes }) {
  if (!VIDEO_MIME_TYPES.has(mimeType)) return { ok: false, error: "Unsupported video format." };
  if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) return { ok: false, error: "File size is required." };
  if (sizeBytes > MAX_UPLOAD_BYTES) return { ok: false, error: "Video exceeds the 5 GB upload limit." };
  return { ok: true };
}

export function selectPipeline({ contentType, durationSeconds }) {
  return contentType === "short" || (Number.isFinite(durationSeconds) && durationSeconds > 0 && durationSeconds <= 90)
    ? "short_mp4"
    : "hls";
}

export function safeMediaExtension(filename) {
  const match = filename.toLowerCase().match(/\.([a-z0-9]{2,5})$/);
  return match ? match[1] : "bin";
}
