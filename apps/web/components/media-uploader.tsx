"use client";

import { useState } from "react";

export function MediaUploader({ contentId }: { contentId: string }) {
  const [status, setStatus] = useState("Choose a video to begin.");
  const [busy, setBusy] = useState(false);

  async function upload(file: File) {
    setBusy(true);
    try {
      setStatus("Preparing secure upload…");
      const createResponse = await fetch("/api/studio/media/uploads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentId, filename: file.name, mimeType: file.type || "application/octet-stream", sizeBytes: file.size }),
      });
      const created = await createResponse.json();
      if (!createResponse.ok) throw new Error(created.error ?? "Upload could not be created.");

      setStatus("Uploading directly to media storage…");
      const uploadResponse = await fetch(created.uploadUrl, { method: "PUT", headers: { "content-type": file.type }, body: file });
      if (!uploadResponse.ok) throw new Error("Storage upload failed.");

      setStatus("Queueing media processing…");
      const completeResponse = await fetch(`/api/studio/media/uploads/${created.assetId}/complete`, { method: "POST" });
      const completed = await completeResponse.json();
      if (!completeResponse.ok) throw new Error(completed.error ?? "Processing could not be queued.");
      setStatus(`Queued for ${completed.pipeline === "short_mp4" ? "short-video" : "adaptive HLS"} processing.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Upload failed.");
    } finally { setBusy(false); }
  }

  return (
    <div className="media-uploader">
      <label className="button button-secondary">
        {busy ? "Working…" : "Upload source video"}
        <input accept="video/mp4,video/quicktime,video/webm,video/x-matroska" disabled={busy} hidden onChange={(event) => { const file = event.currentTarget.files?.[0]; if (file) void upload(file); }} type="file" />
      </label>
      <p aria-live="polite">{status}</p>
    </div>
  );
}
