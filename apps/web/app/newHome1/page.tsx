import Image from "next/image";
import Link from "next/link";
import { searchCatalogue } from "@/lib/catalogue/repository";
import "./new-home.css";

export const dynamic = "force-dynamic";

const FEATURED = [
  { slug: "spring-blender", title: "Spring", meta: "Entertainment · 7m 50s", fallback: "/catalogue/thumbnails/spring-blender.jpeg" },
  { slug: "sprite-fright", title: "Sprite Fright", meta: "Entertainment · 3m 30s", fallback: "/catalogue/thumbnails/sprite-fright.jpeg" },
  { slug: "sintel", title: "Sintel", meta: "Entertainment · 14m 6s", fallback: "/catalogue/thumbnails/sintel.jpeg" },
  { slug: "apollo-11-eagle-has-landed", title: "Eagle Has Landed: The Flight of Apollo 11", meta: "Learn · 20m", fallback: "/catalogue/thumbnails/apollo-11-eagle-has-landed.jpeg" },
] as const;

const CATEGORIES = [
  { slug: "entertainment", title: "Entertainment", copy: "Movies, animation and stories." },
  { slug: "learn", title: "Learn", copy: "Skills, nature and useful ideas." },
  { slug: "pakistan", title: "Pakistan", copy: "Culture, history and people." },
] as const;

export default async function NewHome1Page() {
  let catalogue: Awaited<ReturnType<typeof searchCatalogue>> = [];
  try {
    catalogue = await searchCatalogue({ limit: 100 });
  } catch {
    // Keep the handoff preview usable when the local catalogue is unavailable.
  }
  const bySlug = new Map(catalogue.map((item) => [item.slug, item]));

  return (
    <div className="new-home-page">
      <section className="new-home-hero" aria-labelledby="new-home-title">
        <div className="new-home-hero-copy">
          <span className="new-home-kicker">JALWA · PAKISTAN</span>
          <h1 id="new-home-title">Pakistan ki Kahaniyan, Ab Jalwa Par</h1>
          <p>Pakistan ki liye, aik hi jagah.</p>
          <div className="new-home-actions">
            <Link className="new-home-button new-home-button-primary" href="/explore">Explore Content <span aria-hidden="true">→</span></Link>
            <Link className="new-home-button new-home-button-dark" href="/ask">Jalwa+ <span aria-hidden="true">♛</span></Link>
          </div>
        </div>
        <div className="new-home-hero-art" aria-hidden="true">
          <Image src="/home/homepage-hero-banner.jpeg" alt="" fill priority unoptimized sizes="(max-width: 720px) 100vw, 58vw" />
        </div>
      </section>

      <section className="new-home-section new-home-watch" aria-labelledby="new-home-watch-title">
        <div className="new-home-section-heading">
          <div>
            <span className="new-home-kicker">JALWA ORIGINALS</span>
            <h2 id="new-home-watch-title"><em>More to Watch.</em> More to Explore.</h2>
            <p>Discover what Pakistan is watching right now.</p>
          </div>
          <Link href="/explore" className="new-home-small-button">View All <span aria-hidden="true">→</span></Link>
        </div>
        <div className="new-home-rail">
          <button className="new-home-rail-button" type="button" aria-label="Previous videos">‹</button>
          {FEATURED.map((featured) => {
            const item = bySlug.get(featured.slug);
            return (
              <Link className="new-home-video-card" href={`/watch/${featured.slug}`} key={featured.slug}>
                <div className="new-home-video-art">
                  <Image src={item?.thumbnailUrl ?? featured.fallback} alt="" fill loading="eager" unoptimized sizes="(max-width: 720px) 80vw, 24vw" />
                  {featured.slug === "spring-blender" ? <span className="new-home-original">♛ Jalwa Original</span> : null}
                  <span className="new-home-play" aria-hidden="true">▶</span>
                  <span className="new-home-quality">HD</span>
                </div>
                <h3>{item?.title ?? featured.title}</h3>
                <p>{featured.meta}</p>
              </Link>
            );
          })}
          <button className="new-home-rail-button new-home-rail-next" type="button" aria-label="Next videos">›</button>
        </div>
      </section>

      <section className="new-home-section new-home-discover" aria-labelledby="new-home-discover-title">
        <span className="new-home-kicker">EXPLORE JALWA</span>
        <h2 id="new-home-discover-title">Find something worth watching.</h2>
        <p>Choose what you love. Discover stories and skills from Pakistan and beyond.</p>
        <div className="new-home-category-grid">
          {CATEGORIES.map((category) => (
            <Link href={`/explore?category=${category.slug}`} className="new-home-category" key={category.slug}>
              <h3>{category.title}</h3>
              <p>{category.copy}</p>
              <span>Explore <b aria-hidden="true">→</b></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="new-home-feature-panel new-home-story-panel" aria-labelledby="new-home-story-title">
        <div>
          <span className="new-home-kicker">ABOUT US</span>
          <h2 id="new-home-story-title">Stories that connect Pakistan.</h2>
          <p>Jalwa brings people together through homegrown stories, meaningful learning and entertainment made for every generation.</p>
          <Link className="new-home-button new-home-button-primary" href="/explore">Discover Jalwa <span aria-hidden="true">→</span></Link>
        </div>
        <Image
          className="new-home-section-image"
          src="/home/new-home-stories.jpeg"
          alt="A Pakistani family watching Jalwa together"
          width={1024}
          height={288}
          unoptimized
        />
      </section>

      <section className="new-home-feature-panel new-home-premium-panel" aria-labelledby="new-home-premium-title">
        <div>
          <span className="new-home-kicker">♛ JALWA+</span>
          <h2 id="new-home-premium-title">More to Watch.<br />More to Explore.</h2>
          <p>A larger collection of shows, movies and exclusive stories, all in one place.</p>
          <small>AD-LITE VIEWING &nbsp; · &nbsp; EXCLUSIVE CONTENT &nbsp; · &nbsp; EARLY ACCESS</small>
          <Link className="new-home-button new-home-button-primary" href="/pricing">See Plans &amp; Subscribe <span aria-hidden="true">→</span></Link>
        </div>
        <Image
          className="new-home-section-image new-home-premium-image"
            src="/home/new-home-more-to-watch-transparent.png"
          alt="Jalwa Premium monthly plan artwork"
            width={1460}
            height={885}
          unoptimized
        />
      </section>
    </div>
  );
}
