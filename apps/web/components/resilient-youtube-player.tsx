"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type YTPlayer = {
  destroy(): void;
  getCurrentTime(): number;
  getDuration(): number;
  seekTo(seconds: number, allowSeekAhead: boolean): void;
};

type YTNamespace = {
  Player: new (element: HTMLElement, options: Record<string, unknown>) => YTPlayer;
  PlayerState: { PLAYING: number; ENDED: number };
};

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;
function loadYouTubeApi() {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  if (apiPromise) return apiPromise;
  apiPromise = new Promise((resolve, reject) => {
    const previous = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { previous?.(); if (window.YT) resolve(window.YT); else reject(new Error("YouTube player unavailable.")); };
    const existing = document.querySelector<HTMLScriptElement>('script[src="https://www.youtube.com/iframe_api"]');
    if (!existing) {
      const script = document.createElement("script");
      script.src = "https://www.youtube.com/iframe_api";
      script.async = true;
      script.onerror = () => reject(new Error("YouTube could not be reached."));
      document.head.appendChild(script);
    }
    window.setTimeout(() => { if (!window.YT?.Player) reject(new Error("The video provider did not respond.")); }, 12000);
  });
  return apiPromise;
}

async function saveProgress(contentId: string | undefined, player: YTPlayer, completed = false) {
  if (!contentId) return;
  await fetch("/api/history", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentId, positionSeconds: completed ? player.getDuration() : player.getCurrentTime(), durationSeconds: player.getDuration(), completed }), keepalive: true }).catch(() => undefined);
}

export function ResilientYouTubePlayer({ videoId, title, sourceUrl, contentId }: { videoId: string; title: string; sourceUrl?: string | null; contentId?: string | null }) {
  const mountRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<YTPlayer | null>(null);
  const intervalRef = useRef<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    void loadYouTubeApi().then(async (YT) => {
      if (cancelled || !mountRef.current) return;
      const player = new YT.Player(mountRef.current, {
        videoId,
        playerVars: { rel: 0, playsinline: 1, modestbranding: 1, origin: window.location.origin },
        events: {
          onReady: async () => {
            if (!contentId) return;
            const response = await fetch(`/api/history?contentId=${encodeURIComponent(contentId)}`).catch(() => null);
            if (response?.ok) {
              const data = await response.json();
              if (data.positionSeconds > 5) player.seekTo(data.positionSeconds, true);
            }
          },
          onStateChange: (event: { data: number }) => {
            if (event.data === YT.PlayerState.PLAYING && intervalRef.current === null) intervalRef.current = window.setInterval(() => void saveProgress(contentId ?? undefined, player), 15000);
            if (event.data === YT.PlayerState.ENDED) void saveProgress(contentId ?? undefined, player, true);
          },
          onError: () => setError("This source is unavailable or does not permit playback here."),
        },
      });
      playerRef.current = player;
    }).catch((reason) => setError(reason instanceof Error ? reason.message : "The video source is unavailable."));
    return () => {
      cancelled = true;
      if (intervalRef.current !== null) window.clearInterval(intervalRef.current);
      if (playerRef.current) { void saveProgress(contentId ?? undefined, playerRef.current); playerRef.current.destroy(); }
    };
  }, [contentId, videoId]);

  if (error) return <div className="player-placeholder source-error"><strong>Playback unavailable</strong><p>{error}</p><div className="account-actions"><button className="button button-secondary" type="button" onClick={() => window.location.reload()}>Retry</button>{sourceUrl ? <Link className="button button-secondary" href={sourceUrl} target="_blank" rel="noreferrer">Open original source</Link> : null}</div></div>;
  return <div className="youtube-player" ref={mountRef} aria-label={title} />;
}
