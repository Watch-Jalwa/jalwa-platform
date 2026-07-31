import Link from "next/link";

export default function NotFoundPage() {
  return (
    <div className="page-shell">
      <section className="empty-state">
        <span className="eyebrow">404</span>
        <h1>This Jalwa page is unavailable</h1>
        <p>The title may have been unpublished, removed, or never existed.</p>
        <Link className="button button-primary" href="/explore">Explore Jalwa</Link>
      </section>
    </div>
  );
}
