import Link from "next/link";
import { requireStaff } from "@/lib/studio/auth";
import { roleHasCapability } from "@/lib/studio/capabilities";

export const metadata = { title: { default: "Studio", template: "%s · Jalwa Studio" } };

export default async function StudioLayout({ children }: { children: React.ReactNode }) {
  const { profile } = await requireStaff();
  const canViewFinance = profile.role === "finance" || profile.role === "admin";
  const canViewPremiumReports = roleHasCapability(profile.role, "premium:reports:read");
  const canViewSupport = profile.role === "support" || profile.role === "admin";
  const canModerate = profile.role === "editor" || profile.role === "admin";
  const canOperateMedia = ["editor", "rights_reviewer", "support", "admin"].includes(profile.role);
  const canReviewRights = profile.role === "rights_reviewer" || profile.role === "admin";
  const canViewPrivacy = profile.role === "support" || profile.role === "admin";
  const canViewAi = profile.role === "admin";
  return (
    <div className="studio-shell">
      <aside className="studio-nav">
        <Link className="brand" href="/studio"><span className="brand-mark">J</span> Studio</Link>
        <nav>
          <Link href="/studio">Overview</Link>
          <Link href="/studio/content">Content</Link>
          <Link href="/studio/content/new">Add content</Link>
          {canReviewRights ? <><Link href="/studio/rights">Rights</Link><Link href="/studio/rights/operations">Rights operations</Link></> : null}
          {canOperateMedia ? <><Link href="/studio/media">Media</Link><Link href="/studio/alpha">Internal alpha</Link><Link href="/studio/live">Live operations</Link><Link href="/studio/drm">Protected media</Link></> : null}
          {canModerate ? <Link href="/studio/moderation">Moderation</Link> : null}
          <Link href="/studio/operations">Operations</Link>
          {canViewSupport ? <Link href="/studio/support">Support</Link> : null}
          {canViewPrivacy ? <Link href="/studio/privacy">Privacy</Link> : null}
          {canViewAi ? <Link href="/studio/ai">AI operations</Link> : null}
          {canViewFinance ? <><Link href="/studio/payments">Payment operations</Link><Link href="/studio/finance">Finance operations</Link></> : null}
          {canViewPremiumReports ? <Link href="/studio/finance/reports">Premium reports</Link> : null}
          <Link href="/">View Jalwa</Link>
        </nav>
      </aside>
      <div className="studio-main">{children}</div>
    </div>
  );
}
