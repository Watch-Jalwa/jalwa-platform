import Link from "next/link";

const links = [
  ["/legal/terms", "Terms"],
  ["/legal/privacy", "Privacy"],
  ["/legal/subscriptions", "Subscriptions"],
  ["/legal/copyright", "Copyright"],
  ["/legal/ai-safety", "AI safety"],
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <Link className="brand" href="/" aria-label="Jalwa home"><span className="brand-mark">J</span><span>Jalwa</span></Link>
        <p>Useful content, positive entertainment and AI-powered discovery for Pakistan.</p>
      </div>
      <div className="site-footer-links">
        <nav aria-label="Legal and support">
          {links.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}
          <Link href="/support">Support</Link>
        </nav>
        <p className="site-footer-complaints">
          <a href="mailto:support@digisphere.com.pk">For Complaints: support@digisphere.com.pk</a>
        </p>
      </div>
      <small suppressHydrationWarning>© {new Date().getFullYear()} Jalwa. Third-party content remains subject to its source terms.</small>
    </footer>
  );
}
