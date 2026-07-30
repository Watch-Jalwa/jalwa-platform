"use client";

import Hls from "hls.js";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { OfflineButton } from "@/components/offline-button";

export function SelfHostedPlayer({ contentId, title, poster }: { contentId: string; title: string; poster?: string | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSavedRef = useRef(0);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  useEffect(() => {
    let hls: Hls | null = null;
    let cancelled = false;
    async function load() {
      const response = await fetch(`/api/playback/${contentId}/token`, { method: "POST", headers: { "x-jalwa-device-key": localStorage.getItem("jalwa_device_key") ?? "" } });
      const data = await response.json();
      if (!response.ok) {
        if (!cancelled) setError({ message: data.code === "payment_required" ? "Upgrade to Premium to watch this title." : data.error, code: data.code });
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      if (data.format === "hls" && Hls.isSupported()) {
        hls = new Hls({ enableWorker: true, lowLatencyMode: false });
        hls.loadSource(data.url);
        hls.attachMedia(video);
        hls.on(Hls.Events.ERROR, (_, detail) => { if (detail.fatal) setError({ message: "Playback interrupted. Please retry." }); });
      } else video.src = data.url;
      const history = await fetch(`/api/history?contentId=${encodeURIComponent(contentId)}`).catch(() => null);
      if (history?.ok) {
        const saved = await history.json();
        video.addEventListener("loadedmetadata", () => { if (saved.positionSeconds > 5 && saved.positionSeconds < video.duration - 10) video.currentTime = saved.positionSeconds; }, { once: true });
      }
    }
    void load();
    return () => { cancelled = true; hls?.destroy(); };
  }, [contentId]);

  async function saveProgress(completed = false) {
    const video = videoRef.current;
    if (!video || !Number.isFinite(video.currentTime)) return;
    lastSavedRef.current = video.currentTime;
    await fetch("/api/history", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentId, positionSeconds: completed ? video.duration : video.currentTime, durationSeconds: Number.isFinite(video.duration) ? video.duration : null, completed }), keepalive: true }).catch(() => undefined);
  }

  if (error) return <div className="player-placeholder"><p>{error.message}</p>{error.code === "payment_required" ? <Link className="button button-primary" href="/pricing">View Premium</Link> : <button className="button button-secondary" type="button" onClick={() => window.location.reload()}>Retry</button>}</div>;
  return <div className="self-hosted-stack"><video ref={videoRef} controls playsInline poster={poster ?? undefined} preload="metadata" title={title} onTimeUpdate={(event) => { const current = event.currentTarget.currentTime; if (current - lastSavedRef.current >= 15) void saveProgress(); }} onPause={() => void saveProgress()} onEnded={() => void saveProgress(true)} /><OfflineButton contentId={contentId} title={title} /></div>;
}
