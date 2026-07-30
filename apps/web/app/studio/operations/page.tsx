import { createAdminClient } from "@/lib/supabase/admin";
import { requireStaff } from "@/lib/studio/auth";

export const metadata = { title: "Operations" };
export const dynamic = "force-dynamic";

const requiredConfiguration = [
  "NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "OPENAI_API_KEY", "R2_ACCOUNT_ID",
  "R2_ACCESS_KEY_ID", "R2_SECRET_ACCESS_KEY", "MEDIA_SIGNING_SECRET", "PAYMENT_WEBHOOK_SECRET", "RATE_LIMIT_SALT",
] as const;

export default async function OperationsPage() {
  await requireStaff();
  const admin = createAdminClient();
  const [content, support, checkout, entitlements, accountRequests, analytics] = await Promise.all([
    admin.from("content_items").select("id", { count: "exact", head: true }),
    admin.from("support_cases").select("id", { count: "exact", head: true }).in("status", ["open", "in_progress", "waiting"]),
    admin.from("checkout_orders").select("id", { count: "exact", head: true }).eq("status", "pending"),
    admin.from("entitlements").select("id", { count: "exact", head: true }).eq("status", "active"),
    admin.from("account_requests").select("id", { count: "exact", head: true }).in("status", ["requested", "in_review"]),
    admin.from("analytics_events").select("id", { count: "exact", head: true }).gte("created_at", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()),
  ]);
  const missing = requiredConfiguration.filter((name) => !process.env[name]);
  const cards = [
    ["Catalogue items", content.count ?? 0], ["Open support cases", support.count ?? 0], ["Pending checkouts", checkout.count ?? 0],
    ["Active entitlements", entitlements.count ?? 0], ["Privacy requests", accountRequests.count ?? 0], ["Events in 24 hours", analytics.count ?? 0],
  ];

  return (
    <div className="studio-page">
      <div className="section-heading"><div><span className="eyebrow">Launch</span><h1>Operations</h1></div></div>
      <div className="operations-grid">{cards.map(([label, value]) => <article className="operation-card" key={String(label)}><strong>{value}</strong><span>{label}</span></article>)}</div>
      <section className="account-card"><h2>Production configuration</h2>{missing.length ? <><p className="form-message">Missing runtime configuration:</p><code>{missing.join(", ")}</code></> : <p className="form-success">Required runtime variables are present.</p>}</section>
      <section className="account-card"><h2>Checks</h2><p>Use <code>/api/health</code> for process liveness and <code>/api/readiness</code> for database and configuration readiness.</p></section>
    </div>
  );
}
