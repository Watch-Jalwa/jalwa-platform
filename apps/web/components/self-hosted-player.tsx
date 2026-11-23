"use client";

import Hls from "hls.js";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { OfflineButton } from "@/components/offline-button";

export function SelfHostedPlayer({ contentId, title, poster, audioOnly = false }: { contentId: string; title: string; poster?: string | null; audioOnly?: boolean }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastSavedRef = useRef(0);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [qualityTier, setQualityTier] = useState<"standard" | "enhanced" | null>(null);
  const [maxQualityHeight, setMaxQualityHeight] = useState<number | null>(null);
  const [videoDimensions, setVideoDimensions] = useState<{ width: number; height: number } | null>(null);

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
      setQualityTier(data.qualityTier === "enhanced" ? "enhanced" : "standard");
      setMaxQualityHeight(typeof data.maxQualityHeight === "number" ? data.maxQualityHeight : null);
      const video = audioOnly ? audioRef.current : videoRef.current;
      if (!video) return;
      const credentialed = data.delivery === "cloudfront";
      if (credentialed) video.crossOrigin = "use-credentials";
      if (data.format === "hls" && Hls.isSupported()) {
        hls = new Hls({
          enableWorker: true,
          lowLatencyMode: false,
          ...(credentialed ? { xhrSetup: (xhr: XMLHttpRequest) => { xhr.withCredentials = true; } } : {}),
        });
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
  }, [contentId, audioOnly]);

  async function saveProgress(completed = false) {
    const video = audioOnly ? audioRef.current : videoRef.current;
    if (!video || !Number.isFinite(video.currentTime)) return;
    lastSavedRef.current = video.currentTime;
    await fetch("/api/history", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentId, positionSeconds: completed ? video.duration : video.currentTime, durationSeconds: Number.isFinite(video.duration) ? video.duration : null, completed }), keepalive: true }).catch(() => undefined);
  }

  if (error) return <div className="player-placeholder"><p>{error.message}</p>{error.code === "payment_required" ? <Link className="button button-primary" href="/pricing">View Premium</Link> : <button className="button button-secondary" type="button" onClick={() => window.location.reload()}>Retry</button>}</div>;
  const aspectRatio = videoDimensions ? videoDimensions.width / videoDimensions.height : 16 / 9;
  const mediaStyle = audioOnly ? { aspectRatio: "auto", maxWidth: "100%" } : {
    aspectRatio: `${videoDimensions?.width ?? 16} / ${videoDimensions?.height ?? 9}`,
    // Bound the display by both page width and viewport height without stretching portrait media.
    maxWidth: `min(100%, ${(72 * aspectRatio).toFixed(3)}dvh)`,
  };

  return (
    <div className="self-hosted-stack">
      <div className={audioOnly ? "self-hosted-media-frame self-hosted-media-frame--audio" : "self-hosted-media-frame"} data-testid="self-hosted-media-frame" style={mediaStyle}>
        {audioOnly ? (
          <div className="self-hosted-audio" data-testid="self-hosted-audio">
            <p className="self-hosted-audio-label">Audio recording</p>
            <audio
              ref={audioRef}
              controls
              preload="metadata"
              title={title}
              onTimeUpdate={(event) => {
                const current = event.currentTarget.currentTime;
                if (current - lastSavedRef.current >= 15) void saveProgress();
              }}
              onPause={() => void saveProgress()}
              onEnded={() => void saveProgress(true)}
            />
          </div>
        ) : (
          <video
            ref={videoRef}
            controls
            playsInline
            poster={poster ?? undefined}
            preload="metadata"
            title={title}
            onLoadedMetadata={(event) => {
              const { videoWidth, videoHeight } = event.currentTarget;
              if (videoWidth > 0 && videoHeight > 0) {
                setVideoDimensions({ width: videoWidth, height: videoHeight });
              }
            }}
            onEmptied={() => setVideoDimensions(null)}
            onTimeUpdate={(event) => {
              const current = event.currentTarget.currentTime;
              if (current - lastSavedRef.current >= 15) void saveProgress();
            }}
            onPause={() => void saveProgress()}
            onEnded={() => void saveProgress(true)}
          />
        )}
      </div>
      {qualityTier ? (
        <span className="playback-quality-badge" data-testid="playback-quality-tier">
          {qualityTier === "enhanced" ? `Enhanced quality${maxQualityHeight ? ` · up to ${maxQualityHeight}p` : ""}` : `Standard quality${maxQualityHeight ? ` · up to ${maxQualityHeight}p` : ""}`}
        </span>
      ) : null}
      <OfflineButton contentId={contentId} title={title} />
    </div>
  );
}
