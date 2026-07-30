import Link from "next/link";

const items = [
  ["/", "⌂", "Home"], ["/shorts", "▶", "Shorts"], ["/explore", "▦", "Explore"], ["/ask", "✦", "Ask"], ["/profile", "●", "Profile"]
] as const;

export function BottomNav() {
  return <nav className="bottom-nav" aria-label="Mobile navigation">{items.map(([href, icon, label]) => <Link href={href} key={href}><span aria-hidden="true">{icon}</span>{label}</Link>)}</nav>;
}
