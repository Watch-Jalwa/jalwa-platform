"use client";

import { useEffect } from "react";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    const payload = JSON.stringify({ type: "global_error", message: error.message, stack: error.stack, digest: error.digest, path: window.location.pathname });
    const blob = new Blob([payload], { type: "application/json" });
    if (!navigator.sendBeacon("/api/observability/client-error", blob)) {
      void fetch("/api/observability/client-error", { method: "POST", headers: { "Content-Type": "application/json" }, body: payload, keepalive: true, credentials: "same-origin" });
    }
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="site-main">
          <div className="page-shell">
            <section className="empty-state" role="alert">
              <h1>Jalwa is temporarily unavailable</h1>
              <p>No account or payment action was completed by this error screen.</p>
              <button className="button button-primary" type="button" onClick={reset}>Try again</button>
            </section>
          </div>
        </main>
      </body>
    </html>
  );
}
