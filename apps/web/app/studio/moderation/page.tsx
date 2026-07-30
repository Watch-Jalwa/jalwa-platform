import { redirect } from "next/navigation";
import { requireStaff } from "@/lib/studio/auth";
import { moderateComment, resolveReport, updateCommentSettings } from "./actions";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export const metadata = { title: "Community moderation" };
export const dynamic = "force-dynamic";

export default async function ModerationPage({ searchParams }: { searchParams: SearchParams }) {
  const { supabase, profile } = await requireStaff();
  if (!["editor","admin"].includes(profile.role)) redirect("/studio");
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : null;
  const [{ data: comments }, { data: reports }, { data: settings }] = await Promise.all([
    supabase.from("comments").select("id,body,status,moderation_reason,created_at,user_id,profiles(display_name),content_items(id,slug,title_en)").in("status", ["pending","hidden"]).order("created_at").limit(100),
    supabase.from("content_reports").select("id,reason,details,status,created_at,comment_id,content_id,profiles!content_reports_reporter_id_fkey(display_name),comments(body),content_items(slug,title_en)").in("status", ["open","reviewing"]).order("created_at").limit(100),
    supabase.from("content_comment_settings").select("content_id,comments_enabled,replies_enabled,approval_required,slow_mode_seconds,content_items(slug,title_en)").order("updated_at", { ascending: false }).limit(50),
  ]);

  return <div className="studio-moderation">
    <div className="section-heading"><div><span className="eyebrow">Trust and safety</span><h1>Community moderation</h1></div></div>
    {error ? <p className="policy-notice danger">{error}</p> : null}

    <section className="studio-panel"><h2>Reported content</h2><div className="moderation-list">{reports?.length ? reports.map((report) => <article key={report.id}>
      <header><strong>{report.reason}</strong><time>{new Date(report.created_at).toLocaleString("en-PK")}</time></header>
      <p>{report.details || (report.comments as { body?: string } | null)?.body || "Content report"}</p>
      <small>Reported by {(report.profiles as { display_name?: string } | null)?.display_name ?? "viewer"} · {(report.content_items as { title_en?: string } | null)?.title_en ?? "content"}</small>
      <form action={resolveReport}><input type="hidden" name="reportId" value={report.id} /><input name="note" maxLength={1000} placeholder="Resolution note" /><button className="button button-secondary" name="status" value="reviewing">Assign to me</button><button className="button button-primary" name="status" value="resolved">Resolve</button><button className="button button-secondary" name="status" value="dismissed">Dismiss</button></form>
    </article>) : <p>No open reports.</p>}</div></section>

    <section className="studio-panel"><h2>Comments awaiting action</h2><div className="moderation-list">{comments?.length ? comments.map((comment) => <article key={comment.id}>
      <header><strong>{(comment.profiles as { display_name?: string } | null)?.display_name ?? "viewer"}</strong><span>{comment.status}</span></header>
      <p>{comment.body}</p><small>{(comment.content_items as { title_en?: string } | null)?.title_en}</small>
      <form action={moderateComment}><input type="hidden" name="commentId" value={comment.id} /><input name="reason" maxLength={500} placeholder="Reason for hide/delete" /><button className="button button-primary" name="action" value="approve">Approve</button><button className="button button-secondary" name="action" value="hide">Hide</button><button className="button button-secondary" name="action" value="delete">Delete</button></form>
    </article>) : <p>No comments awaiting moderation.</p>}</div></section>

    <section className="studio-panel"><h2>Comment settings</h2><div className="settings-list">{settings?.map((setting) => <form action={updateCommentSettings} key={setting.content_id}><input type="hidden" name="contentId" value={setting.content_id} /><strong>{(setting.content_items as { title_en?: string } | null)?.title_en ?? setting.content_id}</strong><label><input type="checkbox" name="commentsEnabled" defaultChecked={setting.comments_enabled} /> Comments</label><label><input type="checkbox" name="repliesEnabled" defaultChecked={setting.replies_enabled} /> Replies</label><label><input type="checkbox" name="approvalRequired" defaultChecked={setting.approval_required} /> Approval required</label><label>Slow mode <input type="number" min={0} max={3600} name="slowModeSeconds" defaultValue={setting.slow_mode_seconds} /> seconds</label><button className="button button-secondary">Save</button></form>)}</div></section>
  </div>;
}
