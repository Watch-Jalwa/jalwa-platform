"use client";

import { useEffect } from "react";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("jalwa_route_error", { message: error.message, digest: error.digest });
  }, [error]);

  return (
    <div className="page-shell">
      <section className="empty-state" role="alert">
        <span className="eyebrow">Temporary problem</span>
        <h1>Jalwa could not load this page</h1>
        <p>The application hit a temporary runtime error. Please retry in a moment.</p>
        <button className="button button-primary" type="button" onClick={reset}>Retry</button>
      </section>
    </div>
  );
}
