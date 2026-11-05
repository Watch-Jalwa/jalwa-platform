import Link from "next/link";
import { formatPkr, PREMIUM_BENEFITS } from "@/lib/payments/plans";

export const metadata = { title: "Premium" };

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

/** Default JazzCash landing — guest link start, no sign-in required. */
const MONTHLY_LANDING_HREF = "/mainLanding?utm=D&package=default&parameter=default&payment=jazzcash";
const MONTHLY_AMOUNT_MINOR = 59900;

export default async function PricingPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const selected = typeof params.selected === "string" ? params.selected : "";

  return (
    <div className="page-shell pricing-page">
      <section className="pricing-hero">
        <span className="eyebrow">Jalwa Premium</span>
        <h1>More Jalwa. Less interruption.</h1>
        <p>Premium unlocks Jalwa-controlled content and services. Embedded providers may still show their own ads.</p>
        <div className="trust-row">
          <span>✓ JazzCash hosted wallet linking</span>
          <span>✓ No sign-in required to start</span>
          <span>✓ Verified server webhooks</span>
        </div>
      </section>

      <div className="pricing-grid">
        <article className={`price-card ${selected === "premium-monthly-pkr" ? "selected" : ""}`}>
          <span className="eyebrow">Flexible</span>
          <h2>Monthly</h2>
          <p className="price">
            {formatPkr(MONTHLY_AMOUNT_MINOR)}
            <small> / month</small>
          </p>
          <p>30 days of Premium access. Continue JazzCash linking without signing in.</p>
          <Link className="button button-primary checkout-button" href={MONTHLY_LANDING_HREF}>
            Choose monthly
          </Link>
        </article>

        <article className="price-card price-card-soon">
          <span className="eyebrow">Best value</span>
          <h2>Annual</h2>
          <p className="price">Coming soon</p>
          <p>One payment for 365 days — not available yet.</p>
          <button className="button button-secondary checkout-button" type="button" disabled>
            Coming soon
          </button>
        </article>
      </div>

      <section className="panel benefits-panel">
        <h2>Premium includes</h2>
        <ul>
          {PREMIUM_BENEFITS.map((benefit) => (
            <li key={benefit}>✓ {benefit}</li>
          ))}
        </ul>
      </section>

      <section className="panel payment-note">
        <h2>How payment works</h2>
        <p>
          Choose monthly to open the JazzCash landing. Enter your number, agree to the terms, and complete wallet linking on JazzCash —
          you do not need to sign in first. Jalwa activates Premium only from verified server-side payment state. Never enter your JazzCash MPIN on Jalwa.
        </p>
        <Link href="/legal/terms">View subscription terms</Link>
      </section>
    </div>
  );
}
