import Link from "next/link";
import { LandingSubscribe } from "./landing-subscribe";
import { LandingAnalyticsBoot } from "./landing-analytics-boot";

type Campaign = {
  utm: string;
  package: string;
  parameter: string;
  payment: string;
  planCode: string;
  landing: string;
  landingPath: string;
  queryString: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  ref?: string;
  he?: string;
};

const categories = [
  { title: "Entertainment", copy: "Kahaniyan aur family entertainment, aik jagah.", icon: "play" },
  { title: "Learn & Grow", copy: "Nayi skills aur kaam ki baatein seekhein.", icon: "book" },
] as const;

const trust = [
  { number: "01", title: "Mobile par dekhein", copy: "Apni screen par Jalwa explore karein" },
  { number: "02", title: "Apna content chunein", copy: "Apni pasand ki categories dekhein" },
  { number: "03", title: "Aur bhi explore karein", copy: "Jalwa ki duniya discover karein" },
];

function LandingIcon({ name }: { name: "play" | "book" }) {
  return name === "play" ? (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <rect x="3" y="4" width="18" height="16" rx="3" />
      <path d="m10 8 6 4-6 4z" />
    </svg>
  ) : (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <path d="M12 5C8 2 4 3 3 5v14c3-2 6-2 9 1 3-3 6-3 9-1V5c-1-2-5-3-9 0z" />
      <path d="M12 5v15" />
    </svg>
  );
}

export function LandingShell({
  campaign,
  h1,
  webBannerSrc,
  mobileBannerSrc,
  imageAlt = "Jalwa campaign banner",
  offerNotice,
  ctaHref = "/explore",
  subscribeCta = "Subscribe Now",
}: {
  campaign: Campaign;
  h1: string;
  webBannerSrc: string;
  mobileBannerSrc: string;
  imageAlt?: string;
  offerNotice?: string;
  ctaHref?: string;
  ctaLabel?: string;
  subscribeCta?: string;
}) {
  return (
    <div className="campaign-landing" data-landing={campaign.landing} data-parameter={campaign.parameter}>
      <LandingAnalyticsBoot
        landing={campaign.landing}
        landingPath={campaign.landingPath}
        planCode={campaign.planCode}
        utm={campaign.utm}
        packageCode={campaign.package}
        parameter={campaign.parameter}
        payment={campaign.payment}
        utmSource={campaign.utm_source}
        utmMedium={campaign.utm_medium}
        utmCampaign={campaign.utm_campaign}
        utmContent={campaign.utm_content}
        refCode={campaign.ref}
        he={campaign.he}
      />

      <h1 className="visually-hidden">{h1}</h1>

      <div className="landing-above-fold">
        <section className="landing-hero" aria-label="Jalwa campaign">
          <Link className="landing-hero-link" href={ctaHref} aria-label="Watch Now — explore Jalwa">
            <picture className="landing-hero-picture">
              <source media="(max-width: 720px)" srcSet={mobileBannerSrc} />
              <img
                className="landing-hero-image"
                src={webBannerSrc}
                alt={imageAlt}
              />
            </picture>
          </Link>
        </section>

        <section className="landing-middle" aria-label="JazzCash subscribe">
          <LandingSubscribe
            campaign={campaign}
            offerNotice={offerNotice}
            ctaLabel={subscribeCta}
            heading="Enter Your JazzCash Number"
          />
        </section>
      </div>

      <section className="landing-below" aria-labelledby="landing-offerings">
        <div className="landing-section-top">
          <span className="landing-eyebrow">Explore Jalwa</span>
          <h2 id="landing-offerings">Jalwa par kya milega?</h2>
          <p>Har mood ka apna Jalwa.</p>
        </div>
        <div className="landing-category-grid">
          {categories.map((item) => (
            <article className="landing-category-card" key={item.title}>
              <span className="landing-category-icon"><LandingIcon name={item.icon} /></span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.copy}</p>
              </div>
            </article>
          ))}
        </div>
        <p className="landing-mood">Har mood ka apna Jalwa.</p>
        <div className="landing-trust-row">
          {trust.map((item) => (
            <article key={item.title}>
              <span className="landing-step-number">{item.number}</span>
              <strong>{item.title}</strong>
              <small>{item.copy}</small>
            </article>
          ))}
        </div>
        <p className="landing-legal">
          Jari rakhne se aap Jalwa ki <Link href="/legal/terms">Terms and Conditions</Link> aur{" "}
          <Link href="/legal/privacy">Privacy Policy</Link> se raazi hain.
        </p>
      </section>
    </div>
  );
}
