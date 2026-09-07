"use client";

import { useState } from "react";

type ErrorPayload = { error?: string; message?: string };

type BillingStatus = {
  wallet?: { status?: string };
  alreadySubscribed?: boolean;
};

async function jsonResponse(response: Response) {
  return response.json().catch(() => ({})) as Promise<Record<string, unknown> & ErrorPayload>;
}

function goToSignIn(planCode: string) {
  window.location.href = `/signup?next=${encodeURIComponent(`/pricing?selected=${planCode}`)}&plan=${encodeURIComponent(planCode)}`;
}

export function WalletSubscribe({ planCode, children }: { planCode: string; children: React.ReactNode }) {
  const [msisdn, setMsisdn] = useState("");
  const [consent, setConsent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function begin() {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const statusResponse = await fetch("/api/payments/status", { cache: "no-store" });
      if (statusResponse.status === 401) {
        goToSignIn(planCode);
        return;
      }
      const statusPayload = await jsonResponse(statusResponse) as BillingStatus & ErrorPayload;
      if (!statusResponse.ok) {
        setError(statusPayload.message ?? "Billing is temporarily unavailable.");
        return;
      }
      if (statusPayload.alreadySubscribed) {
        setMessage("You already have an open Jalwa Premium subscription. View Billing for the latest status.");
        return;
      }
      if (statusPayload.wallet?.status === "pending") {
        window.location.href = "/billing/wallet-return?wallet=pending";
        return;
      }
      if (statusPayload.wallet?.status === "linked") {
        const subscribeResponse = await fetch("/api/payments/subscriptions", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ planCode }),
        });
        const subscribePayload = await jsonResponse(subscribeResponse);
        if (subscribeResponse.status === 409 && subscribePayload.error === "already_subscribed") {
          setMessage("You already have an open Jalwa Premium subscription. View Billing for the latest status.");
          return;
        }
        if (!subscribeResponse.ok) {
          setError(subscribePayload.message ?? "Subscription could not be started.");
          return;
        }
        window.location.href = "/billing/wallet-return?wallet=linked";
        return;
      }

      if (!/^[0-9]{11,15}$/.test(msisdn)) {
        setError("Enter your 11–15 digit JazzCash mobile number.");
        return;
      }
      if (!consent) {
        setError("Confirm that you agree to link this JazzCash wallet for automatic subscription debits.");
        return;
      }

      const linkResponse = await fetch("/api/payments/wallets/link", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ msisdn, planCode }),
      });
      const linkPayload = await jsonResponse(linkResponse);
      if (linkResponse.status === 409 && linkPayload.error === "already_linked") {
        window.location.href = "/billing/wallet-return?wallet=linked";
        return;
      }
      if (!linkResponse.ok) {
        setError(linkPayload.message ?? "JazzCash wallet linking could not be started.");
        return;
      }
      if (linkPayload.method !== "POST" || typeof linkPayload.portalUrl !== "string" || !linkPayload.fields || typeof linkPayload.fields !== "object" || Array.isArray(linkPayload.fields)) {
        setError("JazzCash wallet linking returned an invalid response.");
        return;
      }

      const form = document.createElement("form");
      form.method = "POST";
      form.action = linkPayload.portalUrl;
      form.hidden = true;
      for (const [name, value] of Object.entries(linkPayload.fields as Record<string, unknown>)) {
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

  return <div className="wallet-subscribe">
    <label className="form-field wallet-number-field">
      <span>JazzCash mobile number</span>
      <input
        autoComplete="tel"
        inputMode="numeric"
        maxLength={15}
        onChange={(event) => setMsisdn(event.target.value.replace(/\D/g, ""))}
        placeholder="03XXXXXXXXX"
        value={msisdn}
      />
    </label>
    <label className="wallet-consent">
      <input checked={consent} onChange={(event) => setConsent(event.target.checked)} type="checkbox" />
      <span>I agree to link my JazzCash wallet for automatic Jalwa Premium debits. My MPIN is entered only on JazzCash.</span>
    </label>
    <button className="button button-primary checkout-button" disabled={busy} onClick={begin} type="button">{busy ? "Checking billing…" : children}</button>
    {message ? <p className="form-success">{message}</p> : null}
    {error ? <p className="form-error">{error}</p> : null}
  </div>;
}
