"use client";

import { useEffect } from "react";
import { reportClientError } from "@/lib/observability/client";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    reportClientError({
      type: error.name,
      message: error.message,
      stack: error.stack,
      digest: error.digest,
      mechanism: "react.global-error",
    });
  }, [error]);

  return (
    <html lang="en">
      <body>
        <main className="site-main">
          <div className="page-shell">
            <section className="empty-state" role="alert">
              <h1>Jalwa is temporarily unavailable</h1>
              <p>No account or payment action was completed by this error screen.</p>
              {error.digest ? <p>Reference: {error.digest}</p> : null}
              <button className="button button-primary" type="button" onClick={reset}>Try again</button>
            </section>
          </div>
        </main>
      </body>
    </html>
  );
}
