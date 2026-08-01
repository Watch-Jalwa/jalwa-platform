import Link from "next/link";
import { LiveAvailabilityNotice } from "@/components/live-availability-notice";
import { liveSourcesEnabled, type LiveAvailability } from "@/lib/live-sources/registry";

export function OfficialLiveLinkPlayer({
  availability,
  attribution,
  checkedAt,
  officialSourceUrl,
}: {
  availability?: LiveAvailability | null;
  attribution: string;
  checkedAt?: string | null;
  officialSourceUrl: string;
}) {
  if (!liveSourcesEnabled()) {
    return <div className="live-player-fallback">
      <LiveAvailabilityNotice availability="unavailable" message="Official live sources are not enabled in this environment." />
    </div>;
  }

  const currentAvailability = availability ?? "degraded";
  const message = currentAvailability === "unavailable"
    ? "The official source page could not be verified during the latest health check."
    : "Coverage opens on the institution’s official website. Jalwa does not reproduce, restream or record this feed.";

  return <div className="live-player-fallback">
    <LiveAvailabilityNotice availability={currentAvailability} message={message} checkedAt={checkedAt} />
    <Link className="button button-primary" href={officialSourceUrl} rel="noreferrer" target="_blank">
      Open official live coverage ↗
    </Link>
    <p className="live-attribution">{attribution}</p>
  </div>;
}
