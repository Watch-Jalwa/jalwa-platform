"use client";

import Hls from "hls.js";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function SelfHostedPlayer({ contentId, title, poster }: { contentId: string; title: string; poster?: string | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);

  useEffect(() => {
    let hls: Hls | null = null;
    let cancelled = false;
    async function load() {
      const response = await fetch(`/api/playback/${contentId}/token`, { method: "POST" });
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
    }
    void load();
    return () => { cancelled = true; hls?.destroy(); };
  }, [contentId]);

  if (error) return <div className="player-placeholder"><p>{error.message}</p>{error.code === "payment_required" ? <Link className="button button-primary" href="/pricing">View Premium</Link> : null}</div>;
  return <video ref={videoRef} controls playsInline poster={poster ?? undefined} preload="metadata" title={title} />;
}
