import { CheckoutButton } from "@/components/checkout-button";
import { createClient } from "@/lib/supabase/server";
import { formatPkr, PREMIUM_BENEFITS } from "@/lib/payments/plans";

export const metadata = { title: "Premium" };

export default async function PricingPage() {
  const supabase = await createClient();
  const { data: prices } = await supabase.from("prices")
    .select("id,code,amount_minor,currency,billing_period,duration_days,plans!inner(name)")
    .eq("is_active", true).order("amount_minor");

  return (
    <div className="page-shell pricing-page">
      <div className="section-heading"><div><span className="eyebrow">Jalwa Premium</span><h1>More Jalwa. Less interruption.</h1><p>Premium applies to Jalwa-controlled content and services. Embedded providers may still show their own ads.</p></div></div>
      <div className="pricing-grid">
        {(prices ?? []).map((price) => (
          <article className="price-card" key={price.id}>
            <span className="eyebrow">{price.billing_period === "year" ? "Best value" : "Flexible"}</span>
            <h2>{price.billing_period === "year" ? "Annual" : "Monthly"}</h2>
            <p className="price">{formatPkr(price.amount_minor)}<small> / {price.billing_period}</small></p>
            <CheckoutButton priceId={price.id}>Choose {price.billing_period === "year" ? "annual" : "monthly"}</CheckoutButton>
          </article>
        ))}
      </div>
      <section className="panel benefits-panel"><h2>Premium includes</h2><ul>{PREMIUM_BENEFITS.map((benefit) => <li key={benefit}>✓ {benefit}</li>)}</ul></section>
    </div>
  );
}
