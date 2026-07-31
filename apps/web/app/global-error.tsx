"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
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
