import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentsSection } from "@/components/comments-section";
import { DrmPlayer } from "@/components/drm-player";
import { OfficialLiveEmbedPlayer } from "@/components/official-live-embed-player";
import { PublicDomainLiveImagePlayer } from "@/components/public-domain-live-image-player";
import { RecommendationRail } from "@/components/recommendation-rail";
import { ResilientYouTubePlayer } from "@/components/resilient-youtube-player";
import { SelfHostedPlayer } from "@/components/self-hosted-player";
import { SocialActions } from "@/components/social-actions";
import { formatDuration } from "@/lib/catalogue/demo-data";
import { getContentBySlug } from "@/lib/catalogue/repository";
import { getRecommendations } from "@/lib/recommendations/repository";

type Params = Promise<{ slug: string }>;

export default async function WatchPage({ params }: { params: Params }) {
  const { slug } = await params;
  const item = await getContentBySlug(slug);
  if (!item) notFound();
  const related = await getRecommendations({ limit: 12, contextContentId: item.id ?? null, contextSlug: item.slug });
  const liveSource = item.contentType === "live" && item.playback?.sourceKey && item.playback.deliveryAdapter;
  const isYouTube = !liveSource && item.playback?.provider === "youtube" && item.playback.providerContentId;
  const isDrm = Boolean(!liveSource && item.id && item.playback?.drmAssetId);
  const isSelfHosted = !liveSource && item.id && ["self_host_open", "self_host_owned"].includes(item.hostingMode) && item.playback?.mediaAssetId;
  const officialSource = item.playback?.officialSourceUrl ?? item.sourceUrl ?? item.playback?.externalUrl ?? "";
  const attribution = item.attribution ?? item.playback?.requiredAttribution ?? "Official public source.";

  let player: React.ReactNode;
  if (liveSource && item.playback?.deliveryAdapter === "official_live_embed") {
    player = <OfficialLiveEmbedPlayer
      attribution={attribution}
      checkedAt={item.playback.checkedAt}
      officialSourceUrl={officialSource}
      sourceKey={item.playback.sourceKey!}
      title={item.title}
    />;
  } else if (liveSource && item.playback?.deliveryAdapter === "public_domain_live_image") {
    player = <PublicDomainLiveImagePlayer
      attribution={attribution}
      checkedAt={item.playback.checkedAt}
      refreshIntervalSeconds={item.playback.refreshIntervalSeconds ?? 300}
      sourceKey={item.playback.sourceKey!}
      title={item.title}
    />;
  } else if (isYouTube) {
    player = <ResilientYouTubePlayer contentId={item.id} sourceUrl={item.sourceUrl} title={item.title} videoId={item.playback!.providerContentId!} />;
  } else if (isDrm) {
    player = <DrmPlayer contentId={item.id!} poster={item.thumbnailUrl} title={item.title} nextPath={`/watch/${item.slug}`} />;
  } else if (isSelfHosted) {
    player = <SelfHostedPlayer contentId={item.id!} poster={item.thumbnailUrl} title={item.title} />;
  } else {
    player = <div className="player-placeholder"><span className="eyebrow">{item.accessLevel === "premium" ? "Premium" : "Free"}</span><p>Playback source is awaiting media processing, rights approval or final publication.</p></div>;
  }

  return <div className="page-shell watch-layout">
    <div className="player-shell">{player}</div>
    <article className="watch-copy">
      <span className="eyebrow">{item.category} · {item.contentType === "live" ? "Live source" : formatDuration(item.durationSeconds)}</span>
      <h1>{item.title}</h1>
      {item.titleUrdu ? <p className="urdu watch-urdu">{item.titleUrdu}</p> : null}
      {item.description ? <p>{item.description}</p> : null}
      {item.attribution ? <p className="attribution">{item.attribution}</p> : null}
      {liveSource ? <p className="live-non-endorsement">This source is presented for public information. The source agency does not sponsor or endorse Jalwa or its advertisers.</p> : null}
      <div className="watch-actions">
        <Link className="button button-secondary" href="/history">Watch history</Link>
        {item.sourceUrl ? <Link className="button button-secondary" href={item.sourceUrl} rel="noreferrer" target="_blank">View original source ↗</Link> : null}
      </div>
      {liveSource ? null : <SocialActions contentId={item.id} title={item.title} />}
    </article>
    <RecommendationRail items={related} title="Watch next" placement="watch-next" />
    {liveSource ? null : <CommentsSection contentId={item.id} />}
  </div>;
}
