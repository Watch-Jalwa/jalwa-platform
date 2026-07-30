import Link from "next/link";
import { notFound } from "next/navigation";
import { CommentsSection } from "@/components/comments-section";
import { DrmPlayer } from "@/components/drm-player";
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
  const isYouTube = item.playback?.provider === "youtube" && item.playback.providerContentId;
  const isDrm = Boolean(item.id && item.playback?.drmAssetId);
  const isSelfHosted = item.id && ["self_host_open", "self_host_owned"].includes(item.hostingMode) && item.playback?.mediaAssetId;
  return (
    <div className="page-shell watch-layout">
      <div className="player-shell">
        {isYouTube ? <ResilientYouTubePlayer contentId={item.id} sourceUrl={item.sourceUrl} title={item.title} videoId={item.playback!.providerContentId!} /> : isDrm ? <DrmPlayer contentId={item.id!} poster={item.thumbnailUrl} title={item.title} /> : isSelfHosted ? <SelfHostedPlayer contentId={item.id!} poster={item.thumbnailUrl} title={item.title} /> : <div className="player-placeholder"><span className="eyebrow">{item.accessLevel === "premium" ? "Premium" : "Free"}</span><p>Playback source is awaiting media processing, rights approval or final publication.</p></div>}
      </div>
      <article className="watch-copy"><span className="eyebrow">{item.category} · {formatDuration(item.durationSeconds)}</span><h1>{item.title}</h1>{item.titleUrdu ? <p className="urdu watch-urdu">{item.titleUrdu}</p> : null}{item.description ? <p>{item.description}</p> : null}{item.attribution ? <p className="attribution">{item.attribution}</p> : null}<div className="watch-actions"><Link className="button button-secondary" href="/history">Watch history</Link>{item.sourceUrl ? <Link className="button button-secondary" href={item.sourceUrl} rel="noreferrer" target="_blank">View original source ↗</Link> : null}</div><SocialActions contentId={item.id} title={item.title} /></article>
      <RecommendationRail items={related} title="Watch next" placement="watch-next" />
      <CommentsSection contentId={item.id} />
    </div>
  );
}
