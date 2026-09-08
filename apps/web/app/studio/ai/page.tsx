import { requireStaff } from "@/lib/studio/auth";

export const metadata = { title: "AI operations" };
export const dynamic = "force-dynamic";

export default async function AiOperationsPage() {
  const { profile } = await requireStaff();
  if (profile.role !== "admin") return <section className="panel" role="alert"><h1>Permission denied</h1><p>Your Studio role does not include AI operations.</p></section>;

  const provider = process.env.AI_PROVIDER?.trim() || "unconfigured";
  const model = process.env.AI_MODEL?.trim() || "unconfigured";
  const configured = Boolean(process.env.AI_PROVIDER && process.env.AI_MODEL && process.env.AI_API_KEY);

  return <div><div className="section-heading"><div><span className="eyebrow">Operations</span><h1>AI operations</h1><p>Runtime readiness for Jalwa AI features. Credentials are never displayed in Studio.</p></div></div><div className="operations-grid"><article className="operation-card"><strong>{configured ? "Ready" : "Needs configuration"}</strong><span>Provider configuration</span></article><article className="operation-card"><strong>{provider}</strong><span>Provider</span></article><article className="operation-card"><strong>{model}</strong><span>Model</span></article></div></div>;
}
