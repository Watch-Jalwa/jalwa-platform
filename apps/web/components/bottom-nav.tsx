import Link from "next/link";

export function BottomNav({ signedIn }: { signedIn: boolean }) {
  const profileItem = signedIn
    ? ["/profile", "◉", "Profile"]
    : ["/explore", "⌕", "Explore Jalwa"];
  const items = [
    ["/", "⌂", "Home"], ["/for-you", "✦", "For You"], ["/pricing", "♛", "Premium"], profileItem
  ] as const;

  return <nav className="bottom-nav" aria-label="Mobile navigation">{items.map(([href, icon, label]) => <Link href={href} key={href}><span aria-hidden="true">{icon}</span>{label}</Link>)}</nav>;
}
