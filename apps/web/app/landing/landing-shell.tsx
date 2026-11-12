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
  { title: "Entertainment", copy: "Kahaniyan aur family entertainment, aik jagah.", icon: "🎬" },
  { title: "Learn & Grow", copy: "Nayi skills aur kaam ki baatein seekhein.", icon: "📖" },
];

const trust = [
  { title: "Mobile par dekhein", copy: "Apni screen par Jalwa explore karein", icon: "📱" },
  { title: "Apna content chunein", copy: "Apni pasand ki categories dekhein", icon: "▶️" },
  { title: "Aur bhi explore karein", copy: "Jalwa ki duniya discover karein", icon: "🧭" },
];

export function LandingShell({
  campaign,
  h1,
  webBannerSrc,
  mobileBannerSrc,
  offerNotice,
  ctaHref = "/explore",
  subscribeCta = "Subscribe Now",
}: {
  campaign: Campaign;
  h1: string;
  webBannerSrc: string;
  mobileBannerSrc: string;
  offerNotice?: string;
  ctaHref?: string;
  ctaLabel?: string;
  subscribeCta?: string;
}) {
  return (
    <div className="campaign-landing" data-landing={campaign.landing}>
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
                alt="Jalwa — Scroll se aagay. Jalwa dekho."
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
        <div className="landing-section-rule">
          <h2 id="landing-offerings">Jalwa par kya milega?</h2>
        </div>
        <div className="landing-category-grid">
          {categories.map((item) => (
            <article className="landing-category-card" key={item.title}>
              <span aria-hidden="true">{item.icon}</span>
              <h3>{item.title}</h3>
              <p>{item.copy}</p>
            </article>
          ))}
        </div>
        <p className="landing-mood">Har mood ka apna Jalwa.</p>
        <div className="landing-trust-row">
          {trust.map((item) => (
            <article key={item.title}>
              <span aria-hidden="true">{item.icon}</span>
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
