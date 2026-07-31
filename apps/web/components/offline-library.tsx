"use client";

import { useEffect, useState } from "react";

const OFFLINE_CACHE = "jalwa-offline-v2";
type OfflineItem = { id: string; contentId: string; title: string; cacheKey: string; downloadedAt: string; bytesDownloaded: number; expiresAt: string };

export function OfflineLibrary({ items }: { items: OfflineItem[] }) {
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => () => { if (playing) URL.revokeObjectURL(playing.url); }, [playing]);
  useEffect(() => {
    const activeKeys = new Set(items.filter((item) => new Date(item.expiresAt).getTime() > Date.now()).map((item) => item.cacheKey));
    void (async () => {
      await caches.delete("jalwa-offline-v1");
      const cache = await caches.open(OFFLINE_CACHE);
      for (const request of await cache.keys()) {
        if (!activeKeys.has(new URL(request.url).pathname)) await cache.delete(request);
      }
    })();
  }, [items]);

  async function remove(item: OfflineItem) {
    const cache = await caches.open(OFFLINE_CACHE);
    await cache.delete(item.cacheKey);
    await fetch(`/api/offline?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
    if (playing?.id === item.id) {
      URL.revokeObjectURL(playing.url);
      setPlaying(null);
    }
    window.location.reload();
  }

  async function play(item: OfflineItem) {
    if (new Date(item.expiresAt).getTime() <= Date.now()) {
      setMessage("This download expired and has been removed. Download the title again while it is available.");
      await remove(item);
      return;
    }
    const cache = await caches.open(OFFLINE_CACHE);
    const response = await cache.match(item.cacheKey);
    if (!response) { setMessage("This browser no longer has the downloaded file. Remove it and download again."); return; }
    if (playing) URL.revokeObjectURL(playing.url);
    const url = URL.createObjectURL(await response.blob());
    setPlaying({ id: item.id, url });
    setMessage("");
  }

  return <div>{message ? <p className="policy-notice">{message}</p> : null}{playing ? <video className="offline-player" src={playing.url} controls autoPlay playsInline /> : null}<div className="offline-list">{items.map((item) => <article className="offline-card" key={item.id}><div><h2>{item.title}</h2><p>{item.bytesDownloaded ? `${Math.round(item.bytesDownloaded / 1024 / 1024)} MB` : "Stored in this browser"}</p><small>Available until {new Date(item.expiresAt).toLocaleDateString("en-PK")}</small></div><div className="account-actions"><button className="button button-primary" type="button" onClick={() => void play(item)}>Play offline</button><button className="button button-secondary" type="button" onClick={() => void remove(item)}>Remove</button></div></article>)}</div></div>;
}
