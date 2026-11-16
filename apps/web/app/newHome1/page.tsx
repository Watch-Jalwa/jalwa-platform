import Image from "next/image";
import Link from "next/link";
import { searchCatalogue } from "@/lib/catalogue/repository";
import { WatchRail } from "./watch-rail";
import "./new-home.css";

export const dynamic = "force-dynamic";

const FEATURED = [
  { slug: "spring-blender", title: "Spring", meta: "Entertainment · 7m 50s", fallback: "/catalogue/thumbnails/spring-blender.jpeg" },
  { slug: "sprite-fright", title: "Sprite Fright", meta: "Entertainment · 3m 30s", fallback: "/catalogue/thumbnails/sprite-fright.jpeg" },
  { slug: "sintel", title: "Sintel", meta: "Entertainment · 14m 6s", fallback: "/catalogue/thumbnails/sintel.jpeg" },
  { slug: "apollo-11-eagle-has-landed", title: "Eagle Has Landed: Apollo 11", meta: "Learn · 20m", fallback: "/catalogue/thumbnails/apollo-11-eagle-has-landed.jpeg" },
  { slug: "caminandes-llamigos", title: "Caminandes", meta: "Entertainment · 2m", fallback: "/catalogue/thumbnails/caminandes-llamigos.jpeg" },
] as const;

const CATEGORIES = [
  { slug: "entertainment", title: "Entertainment", copy: "Movies, animation & stories.", image: "/catalogue/thumbnails/sprite-fright.jpeg", videoSlug: undefined },
  { slug: "learn", title: "Learn", copy: "Nature, science & discovery.", image: "/catalogue/thumbnails/grca-animals-broll.jpeg", videoSlug: "grca-animals-broll" },
  { slug: "pakistan", title: "Pakistan", copy: "People, culture & stories.", image: "/home/new-home-stories.jpeg", videoSlug: undefined },
] as const;

const LEARNING = [
  { slug: "grca-animals-broll", title: "Animals at Grand Canyon B-roll", copy: "Get closer to the extraordinary natural world.", fallback: "/catalogue/thumbnails/grca-animals-broll.jpeg" },
  { slug: "apollo-11-eagle-has-landed", title: "Journey beyond Earth", copy: "Explore the story behind the first moon landing.", fallback: "/catalogue/thumbnails/apollo-11-eagle-has-landed.jpeg" },
] as const;

export async function NewHomePage() {
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
          <h1 id="new-home-title">Pakistan ki<br />Kahaniyan,<br />Ab Jalwa Par</h1>
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
            <p>Discover films, animation and fascinating stories.</p>
          </div>
        </div>
        <WatchRail>
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
                <h3>{featured.title}</h3>
                <p>{featured.meta}</p>
              </Link>
            );
          })}
        </WatchRail>
      </section>

      <section className="new-home-section new-home-discover" aria-labelledby="new-home-discover-title">
        <h2 id="new-home-discover-title">Explore Jalwa</h2>
        <div className="new-home-category-grid">
          {CATEGORIES.map((category) => (
            <Link href={category.videoSlug ? `/watch/${category.videoSlug}` : `/explore?category=${category.slug}`} className="new-home-category" key={category.slug}>
              <Image src={category.image} alt="" fill sizes="(max-width: 720px) 100vw, 33vw" unoptimized />
              <span className="new-home-category-overlay" aria-hidden="true" />
              <div className="new-home-category-copy">
                <h3>{category.title}</h3>
                <p>{category.copy}</p>
                <span>Explore <b aria-hidden="true">→</b></span>
              </div>
            </Link>
          ))}
        </div>
      </section>

      <section className="new-home-section new-home-learning" aria-labelledby="new-home-learning-title">
        <div className="new-home-section-heading">
          <div>
            <span className="new-home-kicker">DISCOVER MORE</span>
            <h2 id="new-home-learning-title">Watch. Learn. Get curious.</h2>
            <p>Explore the world, from wildlife to space.</p>
          </div>
          <Link href="/explore?category=learn" className="new-home-small-button">Explore learning <span aria-hidden="true">→</span></Link>
        </div>
        <div className="new-home-learning-grid">
          {LEARNING.map((lesson) => {
            const item = bySlug.get(lesson.slug);
            return (
              <Link className="new-home-learning-card" href={`/watch/${lesson.slug}`} key={lesson.slug}>
                <div className="new-home-learning-art">
                  <Image src={item?.thumbnailUrl ?? lesson.fallback} alt="" fill loading="eager" unoptimized sizes="(max-width: 720px) 100vw, 50vw" />
                </div>
                <div>
                  <h3>{item?.title ?? lesson.title}</h3>
                  <p>{lesson.copy}</p>
                  <span>Watch now <b aria-hidden="true">→</b></span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="new-home-feature-panel new-home-story-panel" aria-labelledby="new-home-story-title">
        <div>
          <span className="new-home-kicker">ABOUT US</span>
          <h2 id="new-home-story-title">Pakistan. In every story.</h2>
          <p>Entertainment, learning and the stories that bring us together. Discover a world of content made for curious minds.</p>
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
          <h2 id="new-home-premium-title">Unlock the full Jalwa experience.</h2>
          <p>More stories, more discoveries and access to premium content.</p>
          <small>AD-LITE VIEWING &nbsp; · &nbsp; EXCLUSIVE CONTENT &nbsp; · &nbsp; EARLY ACCESS</small>
          <Link className="new-home-button new-home-button-primary" href="/pricing">Explore premium <span aria-hidden="true">→</span></Link>
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

export default NewHomePage;
