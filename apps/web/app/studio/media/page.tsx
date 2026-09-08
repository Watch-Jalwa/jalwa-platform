import Link from "next/link";
import { requireStaff } from "@/lib/studio/auth";

export const metadata = { title: "Media" };
export const dynamic = "force-dynamic";

export default async function MediaPage() {
  const { profile } = await requireStaff();
  const allowed = ["editor", "rights_reviewer", "support", "admin"].includes(profile.role);
  if (!allowed) return <section className="panel" role="alert"><h1>Permission denied</h1><p>Your Studio role does not include media operations.</p></section>;

  const areas = [
    ["Internal alpha", "Prepare and validate governed media before public activation.", "/studio/alpha"],
    ["Live operations", "Review enabled live sources and their operational state.", "/studio/live"],
    ["Protected media", "Inspect DRM packaging, policies and protected playback readiness.", "/studio/drm"],
  ] as const;

  return <div><div className="section-heading"><div><span className="eyebrow">Operations</span><h1>Media</h1><p>Governed entry point for staging, live and protected media operations.</p></div></div><div className="studio-grid">{areas.map(([title, description, href]) => <article className="panel" key={href}><h2>{title}</h2><p>{description}</p><Link className="button button-secondary" href={href}>Open {title}</Link></article>)}</div></div>;
}
