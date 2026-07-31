"use client";

import { useState } from "react";

const OFFLINE_CACHE = "jalwa-offline-v2";

export function OfflineButton({ contentId, title }: { contentId: string; title: string }) {
  const [status, setStatus] = useState<string>("");
  const [busy, setBusy] = useState(false);

  async function download() {
    if (!("caches" in window)) { setStatus("Offline storage is not supported by this browser."); return; }
    setBusy(true);
    setStatus("Preparing download…");
    let cacheKey: string | null = null;
    try {
      const tokenResponse = await fetch(`/api/playback/${contentId}/token`, { method: "POST", headers: { "x-jalwa-device-key": localStorage.getItem("jalwa_device_key") ?? "" } });
      const token = await tokenResponse.json() as { error?: string; url?: string; format?: string; offlineAllowed?: boolean; offlineExpiresIn?: number };
      if (!tokenResponse.ok) throw new Error(token.error ?? "Playback authorization failed.");
      if (token.format !== "mp4" || !token.offlineAllowed || !token.url) throw new Error("Offline download is available only for public self-hosted MP4 titles.");
      const ttl = Math.max(300, Math.min(Number(token.offlineExpiresIn ?? 604800), 604800));
      const expirySeconds = Math.floor(Date.now() / 1000) + ttl;
      const expiresAt = new Date(expirySeconds * 1000).toISOString();
      cacheKey = `/offline-media/${expirySeconds}-${crypto.randomUUID()}`;

      setStatus("Downloading…");
      const mediaResponse = await fetch(token.url, { cache: "no-store" });
      if (!mediaResponse.ok) throw new Error("The media file could not be downloaded.");
      const bytes = Number(mediaResponse.headers.get("content-length") ?? 0);
      const cache = await caches.open(OFFLINE_CACHE);
      await cache.put(cacheKey, mediaResponse.clone());
      const record = await fetch("/api/offline", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contentId, cacheKey, bytesDownloaded: bytes, expiresAt }),
      });
      if (!record.ok) {
        await cache.delete(cacheKey);
        const result = await record.json().catch(() => ({})) as { error?: string };
        throw new Error(result.error ?? "The download finished but could not be added to your library.");
      }
      setStatus(`${title} is ready offline for up to ${Math.ceil(ttl / 86400)} days.`);
    } catch (error) {
      if (cacheKey) await caches.open(OFFLINE_CACHE).then((cache) => cache.delete(cacheKey)).catch(() => false);
      setStatus(error instanceof Error ? error.message : "Download failed.");
    } finally {
      setBusy(false);
    }
  }

  return <div className="offline-control"><button className="button button-secondary" type="button" disabled={busy} onClick={download}>{busy ? "Downloading…" : "Save offline"}</button>{status ? <small role="status">{status}</small> : null}</div>;
}
