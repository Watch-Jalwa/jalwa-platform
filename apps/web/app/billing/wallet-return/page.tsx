import { Suspense } from "react";
import { PaymentStatusPoller } from "@/components/payment-status-poller";

export const metadata = { title: "Confirm Premium" };

export default function WalletReturnPage() {
  return (
    <div className="page-shell narrow-page">
      <Suspense
        fallback={
          <section className="panel billing-result" aria-live="polite">
            <span className="success-mark">…</span>
            <span className="eyebrow">Confirming securely</span>
            <h1>Confirming your JazzCash wallet</h1>
            <p>Waiting for JazzCash and Jalwa billing to confirm your wallet.</p>
          </section>
        }
      >
        <PaymentStatusPoller />
      </Suspense>
    </div>
  );
}
