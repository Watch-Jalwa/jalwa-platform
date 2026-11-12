import Link from "next/link";
import { HeaderUnsubscribeButton } from "@/components/header-unsubscribe-button";
import { createClient } from "@/lib/database/server";
import { canUseDemoData, hasBackendConfiguration } from "@/lib/runtime";

export async function SiteHeader() {
  let signedIn = false;
  let isPremium = false;
  if (hasBackendConfiguration() && !canUseDemoData()) {
    try {
      const database = await createClient();
      const { data: { user } } = await database.auth.getUser();
      signedIn = Boolean(user);
      if (user) {
        const { data: entitled } = await database.rpc("has_active_benefit", { p_benefit: "premium_catalogue" });
        isPremium = Boolean(entitled);
      }
    } catch {
      signedIn = false;
      isPremium = false;
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
        <Link href="/explore?category=learn">Learn</Link>
        <Link href="/ask">Ask Jalwa</Link>
      </nav>
      <div className="header-actions">
        <HeaderUnsubscribeButton />
        <Link className="button button-primary header-premium" href="/pricing">
          Premium
        </Link>
        {signedIn ? (
          <Link className="button button-secondary header-profile" href="/profile">
            <span>Profile</span>
            {isPremium ? <span className="header-premium-tag">Premium</span> : null}
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
