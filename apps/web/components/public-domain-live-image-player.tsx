"use client";

import { useEffect, useMemo, useState } from "react";
import { LiveAvailabilityNotice } from "@/components/live-availability-notice";

export function PublicDomainLiveImagePlayer({ sourceKey, title, attribution, refreshIntervalSeconds, checkedAt }: {
  sourceKey: string;
  title: string;
  attribution: string;
  refreshIntervalSeconds: number;
  checkedAt?: string | null;
}) {
  const [revision, setRevision] = useState(0);
  const [failed, setFailed] = useState(false);
  const interval = Math.max(60, Math.min(refreshIntervalSeconds, 3600));
  useEffect(() => {
    const timer = window.setInterval(() => {
      setFailed(false);
      setRevision((value) => value + 1);
    }, interval * 1000);
    return () => window.clearInterval(timer);
  }, [interval]);
  const src = useMemo(() => `/api/live-sources/${encodeURIComponent(sourceKey)}/image?r=${revision}`, [sourceKey, revision]);

  return <div className="live-player-stack">
    <div className="live-image-frame">
      {/* The route is a source-key allowlist, not a generic URL proxy. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt={title} decoding="async" loading="eager" onError={() => setFailed(true)} src={src} />
    </div>
    <LiveAvailabilityNotice
      availability={failed ? "unavailable" : "healthy"}
      message={failed ? "The current official camera image could not be loaded." : `Refreshes no faster than every ${Math.round(interval / 60)} minute${interval === 60 ? "" : "s"}.`}
      checkedAt={checkedAt}
    />
    <p className="live-attribution">{attribution}</p>
  </div>;
}
