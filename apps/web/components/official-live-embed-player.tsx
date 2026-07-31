import Link from "next/link";
import { LiveAvailabilityNotice } from "@/components/live-availability-notice";
import { liveSourcesEnabled } from "@/lib/live-sources/registry";
import { resolveOfficialEmbed } from "@/lib/live-sources/security";

export async function OfficialLiveEmbedPlayer({ sourceKey, title, officialSourceUrl, attribution, checkedAt }: {
  sourceKey: string;
  title: string;
  officialSourceUrl: string;
  attribution: string;
  checkedAt?: string | null;
}) {
  if (!liveSourcesEnabled()) {
    return <div className="live-player-fallback">
      <LiveAvailabilityNotice availability="unavailable" message="Public-domain live sources are not enabled in this environment." />
    </div>;
  }

  try {
    const resolved = await resolveOfficialEmbed(sourceKey);
    if (!resolved.embedUrl) {
      return <div className="live-player-fallback">
        <LiveAvailabilityNotice availability={resolved.availability} message={resolved.message} checkedAt={checkedAt} />
        <Link className="button button-secondary" href={officialSourceUrl} rel="noreferrer" target="_blank">View official source ↗</Link>
      </div>;
    }
    return <div className="live-player-stack">
      <div className="live-embed-frame">
        <iframe
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          loading="eager"
          referrerPolicy="strict-origin-when-cross-origin"
          src={resolved.embedUrl}
          title={title}
        />
      </div>
      <LiveAvailabilityNotice availability="healthy" checkedAt={checkedAt} />
      <p className="live-attribution">{attribution}</p>
    </div>;
  } catch (error) {
    console.error("official_live_embed_failed", { sourceKey, error });
    return <div className="live-player-fallback">
      <LiveAvailabilityNotice availability="unavailable" message="The official live player is temporarily unavailable." checkedAt={checkedAt} />
      <Link className="button button-secondary" href={officialSourceUrl} rel="noreferrer" target="_blank">View official source ↗</Link>
    </div>;
  }
}
