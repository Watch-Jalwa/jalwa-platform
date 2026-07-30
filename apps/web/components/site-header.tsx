import Link from "next/link";

export function SiteHeader() {
  return <header className="site-header"><Link className="brand" href="/" aria-label="Jalwa home"><span className="brand-mark">J</span><span>Jalwa</span></Link><nav className="desktop-nav" aria-label="Primary"><Link href="/explore?category=deen">Deen</Link><Link href="/explore?category=kissan">Kissan</Link><Link href="/explore?category=learn">Learn</Link><Link href="/explore?category=entertainment">Entertainment</Link><Link href="/ask">Ask Jalwa</Link></nav><div className="header-actions"><Link className="button button-primary" href="/pricing">Premium</Link><Link className="header-signup" href="/signup">Sign up</Link><Link className="button button-secondary" href="/login">Sign in</Link></div></header>;
}
