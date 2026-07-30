"use client";

import { useEffect, useState } from "react";

type OfflineItem = { id: string; contentId: string; title: string; cacheKey: string; downloadedAt: string; bytesDownloaded: number };

export function OfflineLibrary({ items }: { items: OfflineItem[] }) {
  const [playing, setPlaying] = useState<{ id: string; url: string } | null>(null);
  const [message, setMessage] = useState("");
  useEffect(() => () => { if (playing) URL.revokeObjectURL(playing.url); }, [playing]);

  async function play(item: OfflineItem) {
    const response = await caches.match(item.cacheKey);
    if (!response) { setMessage("This browser no longer has the downloaded file. Remove it and download again."); return; }
    if (playing) URL.revokeObjectURL(playing.url);
    const url = URL.createObjectURL(await response.blob());
    setPlaying({ id: item.id, url }); setMessage("");
  }

  async function remove(item: OfflineItem) {
    const cache = await caches.open("jalwa-offline-v1");
    await cache.delete(item.cacheKey);
    await fetch(`/api/offline?id=${encodeURIComponent(item.id)}`, { method: "DELETE" });
    window.location.reload();
  }

  return <div>{message ? <p className="policy-notice">{message}</p> : null}{playing ? <video className="offline-player" src={playing.url} controls autoPlay playsInline /> : null}<div className="offline-list">{items.map((item) => <article className="offline-card" key={item.id}><div><h2>{item.title}</h2><p>{item.bytesDownloaded ? `${Math.round(item.bytesDownloaded/1024/1024)} MB` : "Stored in this browser"}</p><small>Downloaded {new Date(item.downloadedAt).toLocaleDateString("en-PK")}</small></div><div className="account-actions"><button className="button button-primary" type="button" onClick={() => play(item)}>Play offline</button><button className="button button-secondary" type="button" onClick={() => remove(item)}>Remove</button></div></article>)}</div></div>;
}
