import Link from "next/link";
import "../home-hero.css";

export const metadata = {
  title: "Homepage banner test",
  robots: { index: false, follow: false },
};

export default function HomeBannerTestPage() {
  return (
    <div className="page-shell">
      <p style={{ margin: "0 0 0.85rem", color: "var(--muted)", fontSize: "0.85rem" }}>
        Banner preview — also live on{" "}
        <Link href="/" style={{ color: "var(--brand)" }}>
          homepage
        </Link>
        .
      </p>

      <section className="home-banner-hero" aria-labelledby="home-banner-title">
        <div className="home-banner-media" aria-hidden="true">
          <img
            className="home-banner-image"
            src="/home/homepage-hero-banner.jpeg"
            alt=""
            width={1600}
            height={800}
            decoding="async"
            fetchPriority="high"
          />
        </div>

        <div className="home-banner-copy">
          <span className="eyebrow">Jalwa · Pakistan</span>
          <h1 id="home-banner-title">Pakistan ki kahaniyan, skills aur entertainment aik jagah.</h1>
          <p>
            Mobile-first discovery for Deen, Kissan, learning, technology, rozgar and family-safe
            entertainment.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/explore">
              Explore content
            </Link>
            <Link className="button button-secondary" href="/signup">
              Signup
            </Link>
            <Link className="button button-secondary" href="/login">
              Sign in
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
