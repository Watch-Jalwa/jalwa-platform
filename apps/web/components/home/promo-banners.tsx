import Link from "next/link";

/** About Jalwa + Arena+ vector promo panels (mockup-faithful, fully responsive). */

function AboutArt() {
  return (
    <svg className="promo-art-svg" viewBox="0 0 420 280" role="img" aria-label="Jalwa play graphic">
      <defs>
        <linearGradient id="aboutGlow" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#7c3aed" stopOpacity="0.15" />
          <stop offset="55%" stopColor="#ff7a00" stopOpacity="0.55" />
          <stop offset="100%" stopColor="#fbbf24" stopOpacity="0.9" />
        </linearGradient>
        <linearGradient id="aboutPedestal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#2a1848" />
          <stop offset="100%" stopColor="#0c0618" />
        </linearGradient>
        <filter id="aboutSoft" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="6" />
        </filter>
      </defs>
      <ellipse cx="270" cy="230" rx="110" ry="22" fill="#000" opacity="0.45" />
      <ellipse cx="270" cy="222" rx="92" ry="16" fill="url(#aboutPedestal)" stroke="#ff7a00" strokeOpacity="0.35" />
      <ellipse cx="270" cy="214" rx="70" ry="11" fill="#1a0f2e" stroke="rgba(255,255,255,.12)" />
      <g filter="url(#aboutSoft)" opacity="0.7">
        <polygon points="230,80 330,140 230,200" fill="#ff7a00" />
      </g>
      <g className="promo-float">
        <polygon points="228,78 328,138 228,198" fill="url(#aboutGlow)" stroke="#ffb347" strokeWidth="3" />
        <polygon points="248,118 292,140 248,162" fill="#fff7ed" opacity="0.95" />
      </g>
      <g className="promo-float-slow" opacity="0.9">
        <rect x="300" y="48" width="78" height="52" rx="8" fill="#1b1030" stroke="#a78bfa" strokeOpacity="0.55" />
        <path d="M308 88c12-18 28-28 52-30" fill="none" stroke="#38bdf8" strokeWidth="2" />
        <path d="M308 78c16-8 30-10 48-6" fill="none" stroke="#86efac" strokeWidth="2" />
        <rect x="318" y="118" width="72" height="46" rx="8" fill="#160c28" stroke="#ff7a00" strokeOpacity="0.4" />
        <circle cx="340" cy="138" r="8" fill="#ff7a00" opacity="0.8" />
        <path d="M336 138l7 4v-8z" fill="#1a0b2e" />
      </g>
    </svg>
  );
}

function ArenaArt() {
  return (
    <svg className="promo-art-svg" viewBox="0 0 420 280" role="img" aria-label="Arena plus crown graphic">
      <defs>
        <linearGradient id="arenaTile" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2a1250" />
          <stop offset="50%" stopColor="#1a0b2e" />
          <stop offset="100%" stopColor="#3b0d2e" />
        </linearGradient>
        <linearGradient id="arenaEdge" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0%" stopColor="#ff7a00" />
          <stop offset="100%" stopColor="#fbbf24" />
        </linearGradient>
        <filter id="arenaBloom" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="10" />
        </filter>
      </defs>
      <g filter="url(#arenaBloom)" opacity="0.55">
        <rect x="170" y="70" width="180" height="160" rx="22" transform="rotate(-18 260 150)" fill="#ff7a00" />
      </g>
      <g className="promo-float" transform="rotate(-18 260 150)">
        <rect x="170" y="70" width="180" height="160" rx="22" fill="url(#arenaTile)" stroke="url(#arenaEdge)" strokeWidth="5" />
        <path
          d="M230 118l14 8 14-8 6 18-12 6 8 16-16-6-16 6 8-16-12-6z"
          fill="#fbbf24"
          stroke="#ff7a00"
          strokeWidth="2"
        />
        <circle cx="260" cy="148" r="28" fill="none" stroke="#fbbf24" strokeOpacity="0.35" strokeWidth="2" />
      </g>
      <circle cx="340" cy="210" r="26" fill="#ff7a00" opacity="0.25" />
      <circle cx="350" cy="218" r="14" fill="#fbbf24" opacity="0.45" />
    </svg>
  );
}

export function PromoBanners() {
  return (
    <div className="home-promo-grid">
      <article className="home-promo-card about-promo" data-reveal="left">
        <div className="home-promo-copy">
          <h2>
            <span className="promo-accent-bar" aria-hidden="true" />
            About Jalwa
          </h2>
          <p>
            A homegrown video platform for Pakistan, bringing original stories, useful learning and everyday
            entertainment to one place.
          </p>
          <Link className="promo-outline-btn" href="/explore">
            Learn More <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="home-promo-art" aria-hidden="true">
          <AboutArt />
        </div>
      </article>

      <article className="home-promo-card arena-promo" data-reveal="right">
        <div className="home-promo-copy">
          <h2 className="arena-title">
            <svg viewBox="0 0 20 20" width="22" height="22" aria-hidden="true">
              <path fill="#fbbf24" d="M10 2l2.2 4.5 5 .7-3.6 3.5.9 5L10 13.4 5.5 15.7l.9-5L2.8 7.2l5-.7z" />
            </svg>
            Arena+
          </h2>
          <p className="arena-sub">Upgrade Your Experience</p>
          <ul className="arena-perks">
            <li>
              <span aria-hidden="true">▶</span>
              Ad-Lite Viewing
            </li>
            <li>
              <span aria-hidden="true">🚀</span>
              Early Access to Originals
            </li>
            <li>
              <span aria-hidden="true">★</span>
              Exclusive Content
            </li>
          </ul>
          <Link className="promo-outline-btn" href="/pricing">
            See plans <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="home-promo-art" aria-hidden="true">
          <ArenaArt />
        </div>
      </article>
    </div>
  );
}
