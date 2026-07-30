"use client";

import { useState } from "react";

export function CheckoutButton({ priceId, children }: { priceId: string; children: React.ReactNode }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function checkout() {
    setBusy(true);
    setError(null);
    const response = await fetch("/api/checkout", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ priceId, idempotencyKey: crypto.randomUUID() }),
    });
    const data = await response.json();
    if (response.status === 401) {
      window.location.href = `/login?next=${encodeURIComponent("/pricing")}`;
      return;
    }
    if (!response.ok) {
      setError(data.error ?? "Checkout failed.");
      setBusy(false);
      return;
    }
    window.location.href = data.redirectUrl;
  }

  return (
    <div>
      <button className="button button-primary checkout-button" disabled={busy} onClick={checkout} type="button">
        {busy ? "Opening checkout…" : children}
      </button>
      {error ? <p className="form-error">{error}</p> : null}
    </div>
  );
}
