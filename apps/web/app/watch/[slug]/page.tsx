import Link from "next/link";
import { notFound } from "next/navigation";
import { formatDuration } from "@/lib/catalogue/demo-data";
import { getContentBySlug } from "@/lib/catalogue/repository";

type Params = Promise<{ slug: string }>;

export default async function WatchPage({ params }: { params: Params }) {
  const { slug } = await params;
  const item = await getContentBySlug(slug);
  if (!item) notFound();
  const isYouTube = item.playback?.provider === "youtube" && item.playback.embedUrl;
  return (
    <div className="page-shell watch-layout">
      <div className="player-shell">
        {isYouTube ? (
          <iframe
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
            src={item.playback?.embedUrl ?? undefined}
            title={item.title}
          />
        ) : (
          <div className="player-placeholder"><span className="eyebrow">{item.accessLevel === "premium" ? "Premium" : "Free"}</span><p>Playback source is awaiting media processing or final publication.</p></div>
        )}
      </div>
      <article className="watch-copy">
        <span className="eyebrow">{item.category} · {formatDuration(item.durationSeconds)}</span>
        <h1>{item.title}</h1>
        {item.titleUrdu ? <p className="urdu watch-urdu">{item.titleUrdu}</p> : null}
        {item.description ? <p>{item.description}</p> : null}
        {item.attribution ? <p className="attribution">{item.attribution}</p> : null}
        {item.sourceUrl ? <Link className="source-link" href={item.sourceUrl} rel="noreferrer" target="_blank">View original source ↗</Link> : null}
      </article>
    </div>
  );
}
