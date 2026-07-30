"use client";

import Hls from "hls.js";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type DrmConfig = {
  manifest: { hls: string | null; dash: string | null; preferred: string };
  drmSystems: {
    widevine: { keySystem: "com.widevine.alpha"; licenseUrl: string } | null;
    fairplay: { keySystem: "com.apple.fps"; licenseUrl: string; certificateUrl: string } | null;
  };
  policy: { licenceDurationSeconds: number; minimumSecurityLevel: string; offlineAllowed: false };
};

export function DrmPlayer({ contentId, title, poster }: { contentId: string; title: string; poster?: string | null }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const lastSavedRef = useRef(0);
  const milestonesRef = useRef(new Set<number>());
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let hls: Hls | null = null; let cancelled = false;
    async function load() {
      const deviceKey = localStorage.getItem("jalwa_device_key") ?? "";
      const response = await fetch(`/api/drm/${contentId}/config`, { method: "POST", headers: { "x-jalwa-device-key": deviceKey } });
      const data = await response.json() as DrmConfig & { error?: string; code?: string };
      if (!response.ok) { if (!cancelled) { setError({ message: data.error ?? "Protected playback unavailable.", code: data.code }); setLoading(false); } return; }
      const video = videoRef.current; if (!video) return;
      if (!Hls.isSupported()) { setError({ message: "This browser does not support Jalwa protected HLS playback." }); setLoading(false); return; }
      const drmSystems: Record<string, { licenseUrl: string; serverCertificateUrl?: string }> = {};
      if (data.drmSystems.widevine) drmSystems[data.drmSystems.widevine.keySystem] = { licenseUrl: data.drmSystems.widevine.licenseUrl };
      if (data.drmSystems.fairplay) drmSystems[data.drmSystems.fairplay.keySystem] = { licenseUrl: data.drmSystems.fairplay.licenseUrl, serverCertificateUrl: data.drmSystems.fairplay.certificateUrl };
      hls = new Hls({
        enableWorker: true,
        emeEnabled: true,
        drmSystems,
        drmSystemOptions: { persistentState: "not-allowed", distinctiveIdentifier: "not-allowed", sessionTypes: ["temporary"], sessionType: "temporary", videoRobustness: data.policy.minimumSecurityLevel === "hardware" ? "HW_SECURE_ALL" : "SW_SECURE_DECODE" },
        licenseXhrSetup(xhr) { xhr.withCredentials = true; xhr.setRequestHeader("x-jalwa-device-key", deviceKey); xhr.setRequestHeader("x-jalwa-content-id", contentId); },
      });
      hls.loadSource(data.manifest.hls ?? data.manifest.preferred);
      hls.attachMedia(video);
      hls.on(Hls.Events.MANIFEST_PARSED, () => { setLoading(false); void video.play().catch(() => undefined); });
      hls.on(Hls.Events.ERROR, (_, detail) => { if (detail.fatal) { setLoading(false); setError({ message: detail.type === Hls.ErrorTypes.KEY_SYSTEM_ERROR ? "The DRM licence could not be established for this browser." : "Protected playback was interrupted." }); } });
      const history = await fetch(`/api/history?contentId=${encodeURIComponent(contentId)}`).catch(() => null);
      if (history?.ok) { const saved = await history.json(); video.addEventListener("loadedmetadata", () => { if (saved.positionSeconds > 5 && saved.positionSeconds < video.duration-10) video.currentTime = saved.positionSeconds; }, { once: true }); }
    }
    void load();
    return () => { cancelled = true; hls?.destroy(); };
  }, [contentId]);

  async function saveProgress(completed = false) {
    const video = videoRef.current; if (!video || !Number.isFinite(video.currentTime)) return;
    lastSavedRef.current = video.currentTime;
    await fetch("/api/history", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentId, positionSeconds: completed ? video.duration : video.currentTime, durationSeconds: Number.isFinite(video.duration) ? video.duration : null, completed }), keepalive: true }).catch(() => undefined);
  }

  function track(video: HTMLVideoElement) {
    if (!Number.isFinite(video.duration) || video.duration<=0) return;
    const percent = video.currentTime/video.duration;
    for (const [threshold,eventType] of [[.25,"progress_25"],[.5,"progress_50"],[.9,"progress_90"]] as const) if (percent>=threshold && !milestonesRef.current.has(threshold)) { milestonesRef.current.add(threshold); void fetch("/api/recommendations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentId, eventType }), keepalive: true }).catch(() => undefined); }
  }

  if (error) return <div className="player-placeholder"><p>{error.message}</p>{error.code === "payment_required" ? <Link className="button button-primary" href="/pricing">View Premium</Link> : error.code === "sign_in_required" ? <Link className="button button-primary" href={`/login?next=${encodeURIComponent(location.pathname)}`}>Sign in</Link> : <button className="button button-secondary" type="button" onClick={() => location.reload()}>Retry</button>}</div>;
  return <div className="drm-player-stack"><video ref={videoRef} controls playsInline poster={poster ?? undefined} preload="metadata" title={title} onPlay={() => void fetch("/api/recommendations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentId, eventType: "play_start" }) }).catch(() => undefined)} onTimeUpdate={(event) => { track(event.currentTarget); if (event.currentTarget.currentTime-lastSavedRef.current>=15) void saveProgress(); }} onPause={() => void saveProgress()} onEnded={() => { void saveProgress(true); void fetch("/api/recommendations", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentId, eventType: "complete" }) }).catch(() => undefined); }} />{loading ? <div className="drm-loading">Establishing protected playback…</div> : <span className="drm-badge">Protected</span>}<small>Online playback only. Encrypted offline storage is intentionally disabled for browser compatibility and rights protection.</small></div>;
}
