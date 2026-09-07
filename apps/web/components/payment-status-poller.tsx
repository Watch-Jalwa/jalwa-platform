"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

type WalletState = { status?: "none" | "pending" | "linked" | "unlinked" | "failed"; msisdn_masked?: string | null };
type StatusState = {
  wallet?: WalletState;
  status?: { subscription_status?: string | null; current_period_paid?: boolean; next_due_at?: string | null };
  subscriptions?: Array<{ status?: string; trial_ends_at?: string | null; current_period_end?: string | null; charge_tier?: string | null }>;
};

type ViewState = "checking" | "ready" | "failed" | "delayed";
const MAX_ATTEMPTS = 48;

export function PaymentStatusPoller() {
  const [view, setView] = useState<ViewState>("checking");
  const [detail, setDetail] = useState("Waiting for JazzCash and Jalwa billing to confirm your wallet.");
  const attempts = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | null = null;

    async function poll(delay = 0) {
      if (cancelled) return;
      if (delay) await new Promise((resolve) => { timer = setTimeout(resolve, delay); });
      if (cancelled) return;
      attempts.current += 1;
      try {
        const [walletResponse, statusResponse] = await Promise.all([
          fetch("/api/payments/wallets", { cache: "no-store" }),
          fetch("/api/payments/status", { cache: "no-store" }),
        ]);
        if (walletResponse.status === 401 || statusResponse.status === 401) {
          window.location.href = "/login?next=/billing/wallet-return";
          return;
        }
        if (walletResponse.status === 429 || statusResponse.status === 429) {
          if (attempts.current >= MAX_ATTEMPTS) {
            setView("delayed");
            setDetail("Confirmation is taking longer than expected. Do not start another payment; check Billing for the latest authoritative status.");
            return;
          }
          await poll(5_000 + Math.floor(Math.random() * 2_000));
          return;
        }
        const wallet = await walletResponse.json().catch(() => ({})) as WalletState;
        const status = await statusResponse.json().catch(() => ({})) as StatusState;
        if (!walletResponse.ok || !statusResponse.ok) {
          if (attempts.current >= MAX_ATTEMPTS) {
            setView("delayed");
            setDetail("Billing confirmation is temporarily unavailable. Check Billing before trying anything again.");
            return;
          }
          await poll(3_500 + Math.floor(Math.random() * 1_500));
          return;
        }

        const subscriptionStatus = status.status?.subscription_status ?? status.subscriptions?.[0]?.status ?? null;
        if (wallet.status === "failed") {
          setView("failed");
          setDetail("JazzCash did not complete the wallet link. You can return to Premium and try linking again later.");
          return;
        }
        if (wallet.status === "linked" && ["trialing", "initiated", "active"].includes(subscriptionStatus ?? "")) {
          setView("ready");
          if (subscriptionStatus === "trialing") setDetail("Your JazzCash wallet is linked and your Jalwa Premium trial is active. The first debit will run automatically when the trial ends.");
          else if (subscriptionStatus === "active") setDetail("Your JazzCash wallet and Jalwa Premium access are confirmed.");
          else setDetail("Your JazzCash wallet is linked and the first subscription debit is being processed. Do not submit another payment.");
          return;
        }
        if (["payment_failed", "expired"].includes(subscriptionStatus ?? "")) {
          setView("failed");
          setDetail("The subscription could not be activated. Jalwa will not treat this browser return as payment success.");
          return;
        }
        if (subscriptionStatus === "past_due") {
          setView("failed");
          setDetail("The subscription is past due. Automatic billing retries are handled by the payment service; do not start a duplicate charge.");
          return;
        }
        if (attempts.current >= MAX_ATTEMPTS) {
          setView("delayed");
          setDetail("Confirmation is still pending. Do not start another payment; use Billing to check the latest status.");
          return;
        }
        setDetail(wallet.status === "pending" ? "JazzCash wallet linking is still pending." : "Waiting for the authoritative subscription state.");
        await poll(2_500 + Math.floor(Math.random() * 800));
      } catch {
        if (attempts.current >= MAX_ATTEMPTS) {
          setView("delayed");
          setDetail("Billing confirmation is temporarily unavailable. Check Billing before trying again.");
          return;
        }
        await poll(3_500 + Math.floor(Math.random() * 1_500));
      }
    }

    void poll();
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  return <section className="panel billing-result" aria-live="polite">
    <span className={view === "failed" ? "status-mark status-mark-error" : "success-mark"}>{view === "checking" ? "…" : view === "failed" ? "!" : "✓"}</span>
    <span className="eyebrow">{view === "checking" ? "Confirming securely" : view === "ready" ? "Billing confirmed" : view === "failed" ? "Action needed" : "Still processing"}</span>
    <h1>{view === "ready" ? "Jalwa Premium is ready" : view === "failed" ? "Payment is not confirmed" : view === "delayed" ? "Confirmation is taking longer" : "Confirming your JazzCash wallet"}</h1>
    <p>{detail}</p>
    <p className="policy-notice">Jalwa grants access only from verified server-side payment state. The return URL itself never activates Premium.</p>
    <div className="action-row">
      <Link className="button button-primary" href="/billing">View billing</Link>
      <Link className="button button-secondary" href="/pricing">Premium plans</Link>
    </div>
  </section>;
}
