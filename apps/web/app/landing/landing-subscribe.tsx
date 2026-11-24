"use client";

import Link from "next/link";
import { useMemo, useState, useSyncExternalStore } from "react";
import { trackLandingCheckoutIntent } from "@/lib/landing-analytics.mjs";
import { attributionForBilling } from "@/lib/landing-campaign.mjs";
import { rememberLandingMsisdn, stampUtmAttribution } from "@/lib/utm-attribution.mjs";
import { campaignAnonymousId, campaignConsentGranted, setCampaignConsent, captureCampaignEvent } from "@/lib/campaign-client.mjs";

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
  const [consent, setConsent] = useState(true);
  const [busy, setBusy] = useState(false);
  const analyticsConsent = useSyncExternalStore(
    (onChange) => {
      window.addEventListener("storage", onChange);
      window.addEventListener("jalwa-campaign-consent", onChange);
      return () => {
        window.removeEventListener("storage", onChange);
        window.removeEventListener("jalwa-campaign-consent", onChange);
      };
    },
    campaignConsentGranted,
    () => false,
  );
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

      captureCampaignEvent("landing_cta", campaign);
      captureCampaignEvent("subscribe", campaign);
      stampUtmAttribution(attribution);
      rememberLandingMsisdn(msisdn);

      if (campaignConsentGranted() && typeof window !== "undefined" && typeof window.gtag === "function") {
        window.gtag("event", "landing_cta", { item_id: campaign.planCode, landing: campaign.landing });
        window.gtag("event", "subscribe", { item_id: campaign.planCode, landing: campaign.landing });
        window.gtag("event", "begin_checkout", { item_id: campaign.planCode, landing: campaign.landing });
      }

      // Persist consented first-touch before the wallet-link request is submitted.
      // Tracking network failures never prevent checkout.
      await captureCampaignEvent("begin_checkout", campaign);
      if (campaignConsentGranted()) trackLandingCheckoutIntent({
        landing: campaign.landing,
        landingPath: campaign.landingPath,
        planCode: campaign.planCode,
        utm: campaign.utm,
        packageCode: campaign.package,
        parameter: campaign.parameter,
        payment: campaign.payment,
      });

      const response = await fetch("/api/v1/premium/billing/jazzcash-v11/link/start", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          planCode: campaign.planCode,
          msisdn,
          consentToAutoPay: true,
          // Server generates JazzCash-valid pp_RequestID (ReqId + ≤20 chars). Do not invent one here.
          attribution: { ...attribution, ...(campaignConsentGranted() ? { campaignAnonymousId: campaignAnonymousId() } : {}) },
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

      // POST server-signed fields verbatim — never recompute pp_SecureHash in the browser.
      const form = document.createElement("form");
      form.method = "POST";
      form.action = payload.actionUrl;
      form.acceptCharset = "UTF-8";
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
        <div>
          <h2 id="landing-subscribe-title">{heading}</h2>
          <p className="landing-subscribe-subtitle">Jalwa ki duniya unlock karein.</p>
        </div>
        <span className="landing-offer-badge">Rs. 1 today</span>
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
              I agree to Jalwa <Link href="/legal/terms">Terms and Conditions</Link> .
            </span>
          </label>

          <label className="landing-consent">
            <input checked={analyticsConsent} onChange={event => {
              setCampaignConsent(event.target.checked);
              if (event.target.checked) void captureCampaignEvent("landing_view", campaign);
            }} type="checkbox" />
            <span>Allow optional campaign analytics (not required for checkout).</span>
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
          <span className="landing-offer-info" aria-hidden="true">i
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
