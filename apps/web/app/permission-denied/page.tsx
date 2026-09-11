import Link from "next/link";

export const metadata = { title: "Permission denied" };

export default function PermissionDeniedPage() {
  return (
    <main className="page-shell">
      <section className="panel" role="alert">
        <span className="eyebrow">Access control</span>
        <h1>Permission denied</h1>
        <p>Your account is signed in, but its current role does not include access to this Studio surface.</p>
        <div className="action-row">
          <Link className="button button-primary" href="/">Return to Jalwa</Link>
        </div>
      </section>
    </main>
  );
}
