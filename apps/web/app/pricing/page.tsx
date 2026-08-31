import Link from "next/link";
import { CheckoutButton } from "@/components/checkout-button";
import { createClient } from "@/lib/database/server";
import { formatPkr, PREMIUM_BENEFITS } from "@/lib/payments/plans";
import { hasBackendConfiguration, isFrontendPreview } from "@/lib/runtime";

export const metadata = { title: "Premium" };
type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const demoPrices = [
  { id: "preview-monthly", code: "premium-monthly-pkr", amount_minor: 29900, currency: "PKR", billing_period: "month", duration_days: 30, plans: { name: "Jalwa Premium" } },
  { id: "preview-annual", code: "premium-annual-pkr", amount_minor: 299900, currency: "PKR", billing_period: "year", duration_days: 365, plans: { name: "Jalwa Premium" } },
];

export default async function PricingPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const preview = isFrontendPreview() || !hasBackendConfiguration();
  let prices = demoPrices;
  if (!preview) {
    const database = await createClient();
    const { data } = await database.from("prices").select("id,code,amount_minor,currency,billing_period,duration_days,plans!inner(name)").eq("is_active", true).order("amount_minor");
    prices = (data ?? []) as unknown as typeof demoPrices;
  }
  const selected = typeof params.selected === "string" ? params.selected : "";
  return <div className="page-shell pricing-page"><section className="pricing-hero"><span className="eyebrow">Jalwa Premium</span><h1>More Jalwa. Less interruption.</h1><p>Premium unlocks Jalwa-controlled content and services. Embedded providers may still show their own ads.</p><div className="trust-row"><span>✓ Hosted checkout</span><span>✓ Verified webhooks</span><span>✓ Cancel from billing</span></div></section><div className="pricing-grid">{prices.map((price) => <article className={`price-card ${selected === price.code ? "selected" : ""}`} key={price.id}><span className="eyebrow">{price.billing_period === "year" ? "Best value" : "Flexible"}</span><h2>{price.billing_period === "year" ? "Annual" : "Monthly"}</h2><p className="price">{formatPkr(price.amount_minor)}<small> / {price.billing_period}</small></p><p>{price.billing_period === "year" ? "One payment for 365 days." : "30 days of Premium access."}</p><CheckoutButton preview={preview} priceCode={price.code} priceId={price.id}>Choose {price.billing_period === "year" ? "annual" : "monthly"}</CheckoutButton></article>)}</div><section className="panel benefits-panel"><h2>Premium includes</h2><ul>{PREMIUM_BENEFITS.map((benefit) => <li key={benefit}>✓ {benefit}</li>)}</ul></section><section className="panel payment-note"><h2>How payment works</h2><p>Jalwa creates an order, redirects you to the configured provider and waits for a signed server-to-server webhook. A browser success page never grants Premium by itself.</p><Link href="/legal/terms">View subscription terms</Link></section></div>;
}
