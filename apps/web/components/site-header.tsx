import Link from "next/link";
import { createClient } from "@/lib/database/server";
import { canUseDemoData, hasBackendConfiguration } from "@/lib/runtime";

export async function SiteHeader() {
  let signedIn = false;
  if (hasBackendConfiguration() && !canUseDemoData()) {
    try {
      const database = await createClient();
      const { data: { user } } = await database.auth.getUser();
      signedIn = Boolean(user);
    } catch {
      signedIn = false;
    }
  }

  return (
    <header className="site-header">
      <Link className="brand" href="/" aria-label="Jalwa home">
        <span className="brand-mark">J</span>
        <span>Jalwa</span>
      </Link>
      <nav className="desktop-nav" aria-label="Primary">
        <Link href="/for-you">For You</Link>
        <Link href="/live">Live</Link>
        <Link href="/explore?category=deen">Deen</Link>
        <Link href="/explore?category=kissan">Kissan</Link>
        <Link href="/explore?category=learn">Learn</Link>
        <Link href="/ask">Ask Jalwa</Link>
      </nav>
      <div className="header-actions">
        <Link className="button button-primary" href="/pricing">
          Premium
        </Link>
        {signedIn ? (
          <Link className="button button-secondary" href="/profile">
            Profile
          </Link>
        ) : (
          <>
            <Link className="button button-secondary header-signup" href="/signup">
              Signup
            </Link>
            <Link className="button button-secondary" href="/login">
              Sign in
            </Link>
          </>
        )}
      </div>
    </header>
  );
}
