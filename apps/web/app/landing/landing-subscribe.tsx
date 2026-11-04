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
          idempotencyKey: `land-${campaign.landing}-${msisdn}-${Date.now()}`.slice(0, 40),
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
      <h2 id="landing-subscribe-title">{heading}</h2>
      {offerNotice ? <p className="landing-offer-notice">{offerNotice}</p> : null}
      <label className="form-field">
        <span>JazzCash mobile number</span>
        <input
          autoComplete="tel"
          inputMode="numeric"
          maxLength={11}
          placeholder="03XXXXXXXXX"
          value={msisdn}
          onChange={(event) => setMsisdn(event.target.value.replace(/\D/g, "").slice(0, 11))}
        />
      </label>
      <label className="landing-consent">
        <input checked={consent} onChange={(event) => setConsent(event.target.checked)} type="checkbox" />
        <span>
          I agree to the <Link href="/legal/terms">Terms and Conditions</Link> and{" "}
          <Link href="/legal/privacy">Privacy Policy</Link>. MPIN is entered only on JazzCash.
        </span>
      </label>
      <button className="landing-cta" disabled={busy} onClick={() => void subscribe()} type="button">
        {busy ? "Connecting…" : ctaLabel}
      </button>
      {error ? <p className="form-error" role="alert">{error}</p> : null}
    </section>
  );
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}
