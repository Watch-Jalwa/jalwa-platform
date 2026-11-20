import Link from "next/link";

function PremiumDevicesArt() {
  return (
    <svg className="tamasha-premium-art" viewBox="0 0 360 190" role="img" aria-label="Premium playback on connected devices">
      <defs>
        <linearGradient id="premiumScreen" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#40226e" />
          <stop offset="0.55" stopColor="#17112e" />
          <stop offset="1" stopColor="#090713" />
        </linearGradient>
        <linearGradient id="premiumGlow" x1="0" y1="1" x2="1" y2="0">
          <stop offset="0" stopColor="#ff7a00" />
          <stop offset="1" stopColor="#fbbf24" />
        </linearGradient>
        <filter id="premiumBlur" x="-30%" y="-30%" width="160%" height="160%">
          <feGaussianBlur stdDeviation="9" />
        </filter>
      </defs>
      <ellipse cx="190" cy="174" rx="132" ry="10" fill="#000" opacity="0.45" />
      <g opacity="0.55" filter="url(#premiumBlur)">
        <rect x="112" y="31" width="170" height="108" rx="10" fill="#ff7a00" />
      </g>
      <g className="tamasha-premium-art-float">
        <rect x="105" y="24" width="174" height="112" rx="8" fill="url(#premiumScreen)" stroke="url(#premiumGlow)" strokeWidth="3" />
        <path d="M116 112c28-38 54-40 86-13 23-26 42-32 65-13v38H116z" fill="#f97316" opacity="0.42" />
        <path d="M116 103c25-28 48-31 77-9 22-22 42-26 74-7" fill="none" stroke="#fbbf24" strokeWidth="3" opacity="0.75" />
        <circle cx="192" cy="78" r="18" fill="rgba(0,0,0,.42)" stroke="rgba(255,255,255,.7)" />
        <path d="M188 68l13 10-13 10z" fill="#fff" />
      </g>
      <g className="tamasha-premium-device-float">
        <path d="M57 82l74-12v67l-74 10z" fill="#11101b" stroke="#ff9d2e" strokeWidth="2" />
        <path d="M64 84l60-9v53l-60 9z" fill="#31204e" />
        <path d="M70 119l22-19 13 10 12-16 7 7v29l-54 8z" fill="#8b5cf6" opacity="0.8" />
        <circle cx="94" cy="101" r="5" fill="#fbbf24" />
      </g>
      <g className="tamasha-premium-phone-float">
        <rect x="250" y="112" width="38" height="68" rx="7" fill="#0e0d16" stroke="#fbbf24" strokeWidth="2" transform="rotate(10 269 146)" />
        <rect x="256" y="121" width="26" height="45" rx="3" fill="#34205c" transform="rotate(10 269 146)" />
        <circle cx="269" cy="144" r="7" fill="#ff7a00" opacity="0.9" />
        <path d="M267 139l7 5-7 5z" fill="#fff" />
      </g>
    </svg>
  );
}

export function TamashaPremiumCard({ lockedForPremium }: { lockedForPremium: number }) {
  return (
    <section className="tamasha-premium-banner" aria-labelledby="tamasha-premium-title" data-reveal="up">
      <div className="tamasha-premium-copy">
        <span className="tamasha-premium-kicker">
          <span className="tamasha-crown" aria-hidden="true">♛</span>
          Jalwa <strong>Premium</strong>
        </span>
        <h2 id="tamasha-premium-title">Unlock the Full Jalwa Experience</h2>
        <p>More videos · Exclusive content · Ad-free viewing</p>
        <Link className="tamasha-premium-button" href="/pricing">
          See Plans &amp; Subscribe <span aria-hidden="true">→</span>
        </Link>
      </div>
      <div className="tamasha-premium-visual" aria-hidden="true">
        <PremiumDevicesArt />
      </div>
      <div className="tamasha-premium-cta">
        <strong>Rs 990 <small>/ month</small></strong>
        <span>JazzCash · tax inclusive</span>
        <ul>
          <li><span aria-hidden="true">◉</span> Full catalogue access</li>
          <li><span aria-hidden="true">♛</span> Exclusive &amp; original content</li>
          <li><span aria-hidden="true">◉</span> Ad-free on Jalwa</li>
          <li><span aria-hidden="true">↓</span> Download &amp; watch offline</li>
        </ul>
        {lockedForPremium > 0 ? <small>{lockedForPremium} more titles unlocked with Premium</small> : null}
      </div>
    </section>
  );
}
