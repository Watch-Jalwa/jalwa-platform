"use client";

import { useState } from "react";

export function OfflineButton({ contentId, title }: { contentId: string; title: string }) {
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function download() {
    if (!("caches" in window)) { setStatus("Offline storage is not supported by this browser."); return; }
    setBusy(true); setStatus("Preparing download…");
    try {
      const tokenResponse = await fetch(`/api/playback/${contentId}/token`, { method: "POST", headers: { "x-jalwa-device-key": localStorage.getItem("jalwa_device_key") ?? "" } });
      const token = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(token.error ?? "Playback authorization failed.");
      if (token.format !== "mp4") throw new Error("Offline download is available for self-hosted MP4 titles only.");
      setStatus("Downloading…");
      const mediaResponse = await fetch(token.url);
      if (!mediaResponse.ok) throw new Error("The media file could not be downloaded.");
      const bytes = Number(mediaResponse.headers.get("content-length") ?? 0);
      const cacheKey = `/offline-media/${contentId}`;
      const cache = await caches.open("jalwa-offline-v1");
      await cache.put(cacheKey, mediaResponse.clone());
      const record = await fetch("/api/offline", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentId, cacheKey, bytesDownloaded: bytes }) });
      if (!record.ok) throw new Error("The download finished but could not be added to your library.");
      setStatus(`${title} is ready offline.`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Download failed.");
    } finally { setBusy(false); }
  }

  return <div className="offline-control"><button className="button button-secondary" type="button" disabled={busy} onClick={download}>{busy ? "Downloading…" : "Save offline"}</button>{status ? <small role="status">{status}</small> : null}</div>;
}
