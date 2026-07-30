import Link from "next/link";

type SearchParams = Promise<{ plan?: string }>;
export const metadata = { title: "Checkout preview" };

export default async function PreviewCheckoutPage({ searchParams }: { searchParams: SearchParams }) {
  const { plan } = await searchParams;
  const annual = plan === "premium-annual-pkr";
  return <div className="page-shell checkout-preview"><div className="journey-progress"><span className="done">1 Account</span><span className="done">2 Plan</span><span className="active">3 Provider</span></div><section className="panel hosted-checkout"><span className="eyebrow">Frontend preview</span><h1>{annual ? "Annual" : "Monthly"} Premium checkout</h1><p className="price">{annual ? "PKR 2,999" : "PKR 299"}</p><div className="provider-options"><article><strong>JazzCash</strong><small>Redirect to provider app or hosted page</small></article><article><strong>easypaisa</strong><small>Redirect to provider app or hosted page</small></article><article><strong>PayFast</strong><small>Hosted card and bank checkout</small></article></div><p className="policy-notice">This preview does not collect payment details. Production redirects to the selected merchant provider and activates access only after a verified webhook.</p><div className="account-actions"><Link className="button button-primary" href="/billing/success?preview=1">Simulate verified payment</Link><Link className="button button-secondary" href="/pricing">Back to plans</Link></div></section></div>;
}
