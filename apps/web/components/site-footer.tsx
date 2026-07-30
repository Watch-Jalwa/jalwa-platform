import Link from "next/link";

const links = [
  ["/legal/terms", "Terms"],
  ["/legal/privacy", "Privacy"],
  ["/legal/subscriptions", "Subscriptions"],
  ["/legal/refunds", "Refunds"],
  ["/legal/copyright", "Copyright"],
  ["/legal/ai-safety", "AI safety"],
  ["/support", "Support"],
] as const;

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <div>
        <Link className="brand" href="/" aria-label="Jalwa home"><span className="brand-mark">J</span><span>Jalwa</span></Link>
        <p>Useful content, positive entertainment and AI-powered discovery for Pakistan.</p>
      </div>
      <nav aria-label="Legal and support">{links.map(([href, label]) => <Link href={href} key={href}>{label}</Link>)}</nav>
      <small>© {new Date().getFullYear()} Jalwa. Third-party content remains subject to its source terms.</small>
    </footer>
  );
}
