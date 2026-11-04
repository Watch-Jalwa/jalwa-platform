"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { attributionForBilling } from "@/lib/landing-campaign.mjs";
import { rememberLandingMsisdn, stampUtmAttribution } from "@/lib/utm-attribution.mjs";

type Campaign = {
  utm: string;
  package: string;
  parameter: string;
  payment: string;
  planCode: string;
  landing: string;
  landingPath: string;
  utm_source?: string;
  utm_medium?: string;
  utm_campaign?: string;
  utm_content?: string;
  ref?: string;
  he?: string;
};

export function LandingSubscribe({
  campaign,
  offerNotice,
  heading = "Enter Your JazzCash Number",
  ctaLabel = "Subscribe Now",
}: {
  campaign: Campaign;
  offerNotice?: string;
  heading?: string;
  ctaLabel?: string;
}) {
  const [msisdn, setMsisdn] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const attribution = useMemo(() => attributionForBilling(campaign), [campaign]);

  async function subscribe() {
    setBusy(true);
    setError(null);
    try {
      if (!/^03\d{9}$/.test(msisdn) && !/^923\d{9}$/.test(msisdn)) {
        setError("Enter your JazzCash number as 03XXXXXXXXX.");
        return;
      }
      if (!consent) {
        setError("Agree to the Terms and Conditions to continue.");
        return;
      }

      stampUtmAttribution(attribution);
      rememberLandingMsisdn(msisdn);

      if (typeof window !== "undefined" && typeof window.gtag === "function") {
        window.gtag("event", "add_to_cart", { item_id: campaign.planCode, landing: campaign.landing });
        window.gtag("event", "begin_checkout", { item_id: campaign.planCode, landing: campaign.landing });
      }

      const response = await fetch("/api/v1/premium/billing/jazzcash-v11/link/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planCode: campaign.planCode,
          msisdn,
          consentToAutoPay: true,
          // JazzCash pp_TxnRefNo: keep alphanumeric (no hyphens).
          idempotencyKey: `JL${campaign.landing}${msisdn}${Date.now()}`.replace(/[^A-Za-z0-9]/g, "").slice(0, 20),
          attribution,
        }),
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(payload.message ?? "JazzCash linking could not be started.");
        return;
      }
      if (typeof payload.actionUrl !== "string" || !payload.fields || typeof payload.fields !== "object") {
        setError("JazzCash returned an invalid checkout form.");
        return;
      }

      const form = document.createElement("form");
      form.method = "POST";
      form.action = payload.actionUrl;
      form.hidden = true;
      for (const [name, value] of Object.entries(payload.fields as Record<string, unknown>)) {
        if (typeof value !== "string") continue;
        const input = document.createElement("input");
        input.type = "hidden";
        input.name = name;
        input.value = value;
        form.appendChild(input);
      }
      document.body.appendChild(form);
      form.submit();
    } catch {
      setError("Billing is temporarily unavailable. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="landing-subscribe" aria-labelledby="landing-subscribe-title">
      <div className="landing-subscribe-head">
        <span className="landing-subscribe-phone" aria-hidden="true">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z" />
          </svg>
        </span>
        <h2 id="landing-subscribe-title">{heading}</h2>
      </div>

      <div className="landing-subscribe-landscape">
        <label className="landing-msisdn-field">
          <span className="visually-hidden">JazzCash mobile number</span>
          <span className="landing-msisdn-brand" aria-hidden="true">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="landing-msisdn-mark"
              src="/landing/jazzcash-logo-h.png"
              alt=""
              width={36}
              height={36}
            />
            <span className="landing-msisdn-wordmark">JazzCash</span>
          </span>
          <input
            autoComplete="tel"
            inputMode="numeric"
            maxLength={11}
            placeholder="03XX XXXXXXX"
            value={msisdn}
            onChange={(event) => setMsisdn(event.target.value.replace(/\D/g, "").slice(0, 11))}
          />
        </label>

        <div className="landing-subscribe-actions">
          <label className="landing-consent">
            <input checked={consent} onChange={(event) => setConsent(event.target.checked)} type="checkbox" />
            <span>
              I agree to Jalwa <Link href="/legal/terms">Terms and Conditions</Link>
            </span>
          </label>

          <button className="landing-cta" disabled={busy} onClick={() => void subscribe()} type="button">
            <span className="landing-cta-lock" aria-hidden="true">
              <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                <path d="M17 8h-1V6a4 4 0 0 0-8 0v2H7a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-8a2 2 0 0 0-2-2zm-7-2a2 2 0 1 1 4 0v2h-4V6zm3 10a1.5 1.5 0 1 1 0-3 1.5 1.5 0 0 1 0 3z" />
              </svg>
            </span>
            <span>{busy ? "Connecting…" : ctaLabel}</span>
            <span className="landing-cta-arrow" aria-hidden="true">→</span>
          </button>
        </div>
      </div>

      {offerNotice ? (
        <aside className="landing-offer-banner" aria-label="Offer notice">
          <span className="landing-offer-megaphone" aria-hidden="true">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor">
              <path d="M3 10v4a1 1 0 0 0 1 1h2.2l4.3 3.4A1 1 0 0 0 12 18V6a1 1 0 0 0-1.5-.8L6.2 8.6H4a1 1 0 0 0-1 1zm14.1-2.5a1 1 0 0 0-.7 1.7 4 4 0 0 1 0 5.6 1 1 0 1 0 1.4 1.4 6 6 0 0 0 0-8.4 1 1 0 0 0-.7-.3zm.2 3.1a1 1 0 0 0-.6 1.2 1.5 1.5 0 0 1 0 1.4 1 1 0 1 0 1.8.8 3.5 3.5 0 0 0 0-3 1 1 0 0 0-1.2-.4z" />
            </svg>
          </span>
          <p>{offerNotice}</p>
        </aside>
      ) : null}

      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </section>
  );
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}
