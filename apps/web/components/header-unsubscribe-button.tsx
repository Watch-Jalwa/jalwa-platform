"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";

type Step = "closed" | "msisdn" | "confirm" | "done";

type LookupResult = {
  ok?: boolean;
  hasSubscription?: boolean;
  msisdnMasked?: string;
  planName?: string;
  message?: string;
  error?: string;
};

export function HeaderUnsubscribeButton() {
  const titleId = useId();
  const inputRef = useRef<HTMLInputElement>(null);
  const [step, setStep] = useState<Step>("closed");
  const [msisdn, setMsisdn] = useState("");
  const [lookup, setLookup] = useState<LookupResult | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [showPlansCta, setShowPlansCta] = useState(false);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (step === "msisdn") {
      const timer = window.setTimeout(() => inputRef.current?.focus(), 40);
      return () => window.clearTimeout(timer);
    }
    return undefined;
  }, [step]);

  function close() {
    if (pending) return;
    setStep("closed");
    setMsisdn("");
    setLookup(null);
    setMessage(null);
    setShowPlansCta(false);
  }

  async function checkNumber() {
    setPending(true);
    setMessage(null);
    setShowPlansCta(false);
    try {
      const response = await fetch("/api/v1/premium/billing/unsubscribe/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ msisdn }),
      });
      const payload = await response.json().catch(() => ({})) as LookupResult;
      if (!response.ok) {
        setMessage(payload.message || "Could not check this JazzCash number.");
        return;
      }
      setLookup(payload);
      if (payload.hasSubscription) {
        setStep("confirm");
      } else {
        setMessage("No Jalwa Premium subscription was found for this JazzCash number.");
        setShowPlansCta(true);
      }
    } catch {
      setMessage("Could not check this JazzCash number.");
    } finally {
      setPending(false);
    }
  }

  async function confirmUnsubscribe() {
    setPending(true);
    setMessage(null);
    setShowPlansCta(false);
    try {
      const response = await fetch("/api/v1/premium/billing/unsubscribe/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ msisdn, confirm: true }),
      });
      const payload = await response.json().catch(() => ({})) as LookupResult & { ok?: boolean };
      if (!response.ok || !payload.ok) {
        setMessage(payload.message || "Could not cancel Premium right now.");
        return;
      }
      setLookup(payload);
      setStep("done");
    } catch {
      setMessage("Could not cancel Premium right now.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        className="button button-secondary header-unsubscribe"
        type="button"
        onClick={() => {
          setStep("msisdn");
          setMessage(null);
          setShowPlansCta(false);
          setLookup(null);
        }}
      >
        Unsubscribe
      </button>

      {step === "closed" ? null : (
        <div className="unsubscribe-modal-backdrop" role="presentation" onClick={close}>
          <div
            className="unsubscribe-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            onClick={(event) => event.stopPropagation()}
          >
            {step === "msisdn" ? (
              <>
                <h2 id={titleId}>Unsubscribe</h2>
                <p>Enter the JazzCash mobile number used for Jalwa Premium.</p>
                <label className="form-field">
                  <span>JazzCash number</span>
                  <input
                    ref={inputRef}
                    name="msisdn"
                    inputMode="numeric"
                    autoComplete="tel"
                    maxLength={20}
                    placeholder="03001234567"
                    value={msisdn}
                    onChange={(event) => setMsisdn(event.target.value)}
                    disabled={pending}
                  />
                </label>
                {message ? (
                  <p className="form-message" role="alert">
                    {message}
                    {showPlansCta ? (
                      <>
                        {" "}
                        <Link className="unsubscribe-plans-link" href="/pricing" onClick={close}>
                          Click Here to view plans.
                        </Link>
                      </>
                    ) : null}
                  </p>
                ) : null}
                <div className="unsubscribe-modal-actions">
                  <button className="button button-secondary" type="button" onClick={close} disabled={pending}>
                    Close
                  </button>
                  <button className="button button-primary" type="button" onClick={() => void checkNumber()} disabled={pending || !msisdn.trim()}>
                    {pending ? "Checking…" : "Continue"}
                  </button>
                </div>
              </>
            ) : null}

            {step === "confirm" ? (
              <>
                <h2 id={titleId}>Cancel subscription?</h2>
                <p>
                  Are you sure you want to cancel your subscription
                  {lookup?.planName ? ` (${lookup.planName})` : ""}
                  {lookup?.msisdnMasked ? ` for ${lookup.msisdnMasked}` : ""}?
                </p>
                <p className="form-message">Premium access stops immediately after confirmation.</p>
                {message ? <p className="form-message" role="alert">{message}</p> : null}
                <div className="unsubscribe-modal-actions">
                  <button className="button button-secondary" type="button" onClick={() => setStep("msisdn")} disabled={pending}>
                    Back
                  </button>
                  <button className="button button-danger" type="button" onClick={() => void confirmUnsubscribe()} disabled={pending}>
                    {pending ? "Unsubscribing…" : "Yes, unsubscribe"}
                  </button>
                </div>
              </>
            ) : null}

            {step === "done" ? (
              <>
                <h2 id={titleId}>Unsubscribed</h2>
                <p>{lookup?.message || "Premium access has been stopped. Your plan is now Free."}</p>
                <div className="unsubscribe-modal-actions">
                  <button className="button button-primary" type="button" onClick={close}>
                    Done
                  </button>
                </div>
              </>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
}
