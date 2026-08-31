import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/database/server";
import { formatPkr } from "@/lib/payments/plans";

type SearchParams = Promise<{ order?: string }>;

export default async function MockCheckoutPage({ searchParams }: { searchParams: SearchParams }) {
  if (process.env.NODE_ENV === "production" && process.env.ALLOW_MOCK_PAYMENTS !== "true") notFound();
  const { order: orderId } = await searchParams;
  if (!orderId) notFound();

  const database = await createClient();
  const { data: { user } } = await database.auth.getUser();
  if (!user) redirect(`/login?next=${encodeURIComponent(`/checkout/mock?order=${orderId}`)}`);

  const { data: order } = await database.from("checkout_orders")
    .select("id,amount_minor,currency,status,prices(code,billing_period)")
    .eq("id", orderId).eq("user_id", user.id).maybeSingle();
  if (!order) notFound();

  return (
    <div className="page-shell narrow-page">
      <section className="panel mock-checkout">
        <span className="eyebrow">Sandbox checkout</span>
        <h1>Confirm Jalwa Premium</h1>
        <p className="price">{formatPkr(order.amount_minor)}</p>
        <p>This page simulates a hosted provider checkout for development and testing.</p>
        <form action="/api/payments/mock/complete" method="post">
          <input name="orderId" type="hidden" value={order.id} />
          <button className="button button-primary" type="submit">Complete test payment</button>
        </form>
      </section>
    </div>
  );
}
