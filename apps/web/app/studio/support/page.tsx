import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/database/admin";
import { requireStaff } from "@/lib/studio/auth";
import { updateSupportCase } from "./actions";

export const metadata = { title: "Support queue" };

export default async function StudioSupportPage() {
  const { profile } = await requireStaff();
  if (profile.role !== "support" && profile.role !== "admin") redirect("/studio");
  const admin = createAdminClient();
  const { data: cases } = await admin.from("support_cases")
    .select("id,email,case_type,subject,message,status,created_at")
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <div className="studio-page">
      <div className="section-heading"><div><span className="eyebrow">Operations</span><h1>Support queue</h1></div></div>
      <div className="support-queue">
        {cases?.length ? cases.map((item) => (
          <article className="support-case" key={item.id}>
            <header><div><span className="eyebrow">{item.case_type}</span><h2>{item.subject}</h2></div><time>{new Date(item.created_at).toLocaleString("en-PK")}</time></header>
            <p>{item.message}</p>
            <small>{item.email ?? "Signed-in user without email"} · {item.id}</small>
            <form action={updateSupportCase}>
              <input type="hidden" name="id" value={item.id} />
              <select name="status" defaultValue={item.status}><option value="open">Open</option><option value="in_progress">In progress</option><option value="waiting">Waiting</option><option value="resolved">Resolved</option><option value="closed">Closed</option></select>
              <button className="button button-secondary" type="submit">Update</button>
            </form>
          </article>
        )) : <div className="empty-state">No support cases.</div>}
      </div>
    </div>
  );
}
