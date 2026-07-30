"use client";

import Hls from "hls.js";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";

export function LivePlayer({ channelId, poster, title }: { channelId: string; poster?: string | null; title: string }) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const sessionRef = useRef(crypto.randomUUID());
  const startedRef = useRef(Date.now());
  const profileRef = useRef<string | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "idle" | "error">("loading");
  const [message, setMessage] = useState("Connecting to the live channel…");
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    let hls: Hls | null = null; let cancelled = false; let heartbeat: ReturnType<typeof setInterval> | null = null;
    async function load() {
      const response = await fetch(`/api/live/${channelId}/playback`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) { if (!cancelled) { setState(data.code === "not_live" ? "idle" : "error"); setMessage(data.error ?? "Live playback unavailable."); setCode(data.code ?? null); } return; }
      profileRef.current = data.viewerProfileId ?? null;
      const video = videoRef.current; if (!video) return;
      const source = data.hls ?? data.dash;
      if (data.hls && Hls.isSupported()) {
        hls = new Hls({ enableWorker: true, lowLatencyMode: true, backBufferLength: 30, liveSyncDurationCount: 3, liveMaxLatencyDurationCount: 10 });
        hls.loadSource(data.hls); hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => { setState("ready"); setMessage(""); void video.play().catch(() => undefined); });
        hls.on(Hls.Events.ERROR, (_, detail) => { if (detail.fatal) { setState("error"); setMessage("The live feed was interrupted. Retry to reconnect."); } });
      } else if (source) {
        video.src = source;
        video.addEventListener("loadedmetadata", () => { setState("ready"); setMessage(""); }, { once: true });
      }
      const touch = () => fetch(`/api/live/${channelId}/session`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionKey: sessionRef.current, viewerProfileId: profileRef.current, watchSeconds: Math.floor((Date.now()-startedRef.current)/1000), quality: video.videoHeight ? `${video.videoHeight}p` : null }), keepalive: true }).catch(() => undefined);
      void touch(); heartbeat = setInterval(() => void touch(), 30000);
    }
    void load();
    return () => { cancelled = true; if (heartbeat) clearInterval(heartbeat); hls?.destroy(); };
  }, [channelId]);

  if (state === "idle" || state === "error") return <div className="player-placeholder live-placeholder"><span className="live-dot" /> <p>{message}</p>{code === "payment_required" ? <Link className="button button-primary" href="/pricing">View Premium</Link> : code === "sign_in_required" ? <Link className="button button-primary" href={`/login?next=/live/${channelId}`}>Sign in</Link> : <button className="button button-secondary" type="button" onClick={() => window.location.reload()}>Retry</button>}</div>;
  return <div className="live-player-stack"><video ref={videoRef} controls playsInline poster={poster ?? undefined} title={title} />{state === "loading" ? <div className="live-loading"><span className="live-dot" />{message}</div> : <span className="live-badge">LIVE</span>}</div>;
}
