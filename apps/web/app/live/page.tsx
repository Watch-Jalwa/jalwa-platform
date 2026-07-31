import Link from "next/link";
import { getLiveCatalogue } from "@/lib/catalogue/repository";
import { liveSourcesEnabled } from "@/lib/live-sources/registry";
import type { CatalogueItem } from "@/lib/catalogue/types";

export const dynamic = "force-dynamic";

function LiveCard({ item }: { item: CatalogueItem }) {
  const status = item.playback?.availability ?? "degraded";
  const label = status === "healthy" ? "Live" : status === "off_air" ? "Off air" : status === "unavailable" ? "Unavailable" : "Checking";
  return <article className="live-card">
    <Link href={`/watch/${item.slug}`}>
      <div className="live-card-art" aria-hidden="true"><span className={`live-card-status live-card-status-${status}`}>{label}</span></div>
      <h3>{item.title}</h3>
      {item.titleUrdu ? <p className="urdu">{item.titleUrdu}</p> : null}
      <p>{item.description}</p>
    </Link>
    {item.playback?.officialSourceUrl ? <Link className="live-source-link" href={item.playback.officialSourceUrl} rel="noreferrer" target="_blank">Official source ↗</Link> : null}
  </article>;
}

export default async function LivePage() {
  if (!liveSourcesEnabled()) {
    return <div className="page-shell"><section className="live-hero"><span className="eyebrow">Public information</span><h1>Live sources</h1><p>The approved public-domain live catalogue is installed but disabled in this environment.</p></section></div>;
  }
  const catalogue = await getLiveCatalogue();
  const liveNow = catalogue.items.filter((item) => item.playback?.availability === "healthy" || item.playback?.availability === "degraded");
  const offAir = catalogue.items.filter((item) => item.playback?.availability === "off_air");
  return <div className="page-shell live-page">
    <section className="live-hero">
      <span className="eyebrow">NASA · NOAA · USGS</span>
      <h1>Official live public sources</h1>
      <p>Free public-information streams and current camera views. Jalwa does not restream, record or place advertising over an external player.</p>
    </section>

    <section aria-labelledby="live-now-heading">
      <div className="section-heading"><div><span className="eyebrow">Available</span><h2 id="live-now-heading">Live now</h2></div></div>
      {liveNow.length ? <div className="live-grid">{liveNow.map((item) => <LiveCard item={item} key={item.slug} />)}</div> : <div className="empty-state">No approved source is live at the moment.</div>}
    </section>

    {offAir.length ? <section aria-labelledby="off-air-heading">
      <div className="section-heading"><div><span className="eyebrow">Scheduled operations</span><h2 id="off-air-heading">Temporarily off air</h2></div></div>
      <div className="live-grid">{offAir.map((item) => <LiveCard item={item} key={item.slug} />)}</div>
    </section> : null}

    {catalogue.collections.map((collection) => <section aria-labelledby={`${collection.slug}-heading`} key={collection.slug}>
      <div className="section-heading"><div><span className="eyebrow">Public-domain cameras</span><h2 id={`${collection.slug}-heading`}>{collection.title}</h2><p>{collection.description}</p></div></div>
      <div className="live-grid">{collection.items.map((item) => <LiveCard item={item} key={item.slug} />)}</div>
    </section>)}

    <aside className="live-disclaimer">
      <strong>Source and advertising boundary</strong>
      <p>NASA, NOAA and USGS do not sponsor or endorse Jalwa. Advertising may appear only in Jalwa-owned page regions and never over an official player or current-image view.</p>
    </aside>
  </div>;
}
