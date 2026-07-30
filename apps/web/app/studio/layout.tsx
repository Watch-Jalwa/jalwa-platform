import Link from "next/link";
import { requireStaff } from "@/lib/studio/auth";

export const metadata = { title: { default: "Studio", template: "%s · Jalwa Studio" } };

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireStaff();
  const canViewFinance = profile.role === "finance" || profile.role === "admin";
  return (
    <div className="studio-shell">
      <aside className="studio-nav">
        <Link className="brand" href="/studio"><span className="brand-mark">J</span> Studio</Link>
        <nav><Link href="/studio">Overview</Link><Link href="/studio/content">Content</Link><Link href="/studio/content/new">Add content</Link>{canViewFinance ? <Link href="/studio/finance">Finance</Link> : null}<Link href="/">View Jalwa</Link></nav>
      </aside>
      <div className="studio-main">{children}</div>
    </div>
  );
}
