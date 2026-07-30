"use client";

import Link from "next/link";
import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";

type Comment = {
  id: string;
  userId: string;
  parentId: string | null;
  author: string;
  body: string;
  language: string;
  score: number;
  replyCount: number;
  likedByMe: boolean;
  editedAt: string | null;
  createdAt: string;
  mine: boolean;
};

type Settings = { commentsEnabled: boolean; repliesEnabled: boolean; approvalRequired?: boolean; slowModeSeconds: number };

export function CommentsSection({ contentId }: { contentId?: string | null }) {
  const [comments, setComments] = useState<Comment[]>([]);
  const [settings, setSettings] = useState<Settings>({ commentsEnabled: true, repliesEnabled: true, slowModeSeconds: 15 });
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const response = await fetch(`/api/comments?contentId=${encodeURIComponent(contentId ?? "preview")}`, { cache: "no-store" });
    const data = await response.json();
    if (response.ok) { setComments(data.comments ?? []); setSettings(data.settings ?? settings); }
  }, [contentId]);

  useEffect(() => { void load(); }, [load]);

  const roots = useMemo(() => comments.filter((comment) => !comment.parentId), [comments]);
  const replies = useMemo(() => {
    const map = new Map<string, Comment[]>();
    for (const comment of comments) if (comment.parentId) map.set(comment.parentId, [...(map.get(comment.parentId) ?? []), comment]);
    return map;
  }, [comments]);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/comments", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentId, parentId: replyTo, body: form.get("body"), language: form.get("language") }) });
    const data = await response.json();
    if (response.status === 401) { window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`; return; }
    if (!response.ok) setMessage(data.error ?? "Comment could not be posted.");
    else { event.currentTarget.reset(); setReplyTo(null); setMessage(data.preview ? "Preview comment accepted locally; production persists it." : settings.approvalRequired ? "Comment sent for review." : "Comment posted."); await load(); }
    setBusy(false);
  }

  async function react(comment: Comment) {
    const response = await fetch(`/api/comments/${comment.id}/reaction`, { method: "POST" });
    if (response.status === 401) { window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`; return; }
    const data = await response.json();
    if (response.ok) setComments((current) => current.map((item) => item.id === comment.id ? { ...item, score: data.score, likedByMe: !item.likedByMe } : item));
  }

  async function remove(commentId: string) {
    if (!window.confirm("Remove this comment?")) return;
    const response = await fetch("/api/comments", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ commentId, action: "delete" }) });
    if (response.ok) await load();
  }

  async function report(comment: Comment, mode: "report" | "block" | "mute") {
    const payload = mode === "block" ? { blockUserId: comment.userId } : mode === "mute" ? { muteUserId: comment.userId } : { reason: "other", details: "Reported from the watch page." };
    const response = await fetch(`/api/comments/${comment.id}/report`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    if (response.status === 401) { window.location.href = `/login?next=${encodeURIComponent(window.location.pathname)}`; return; }
    setMessage(response.ok ? (mode === "report" ? "Report submitted for moderation." : `${mode === "block" ? "Blocked" : "Muted"} ${comment.author}.`) : "The action could not be completed.");
    if (response.ok && mode !== "report") await load();
  }

  function CommentCard({ comment, nested = false }: { comment: Comment; nested?: boolean }) {
    return <article className={`comment-card ${nested ? "comment-reply" : ""}`}>
      <header><strong>{comment.author}</strong><time>{new Date(comment.createdAt).toLocaleString("en-PK", { dateStyle: "medium", timeStyle: "short" })}</time></header>
      <p className={comment.language === "ur" ? "urdu" : ""}>{comment.body}</p>
      <footer>
        <button type="button" onClick={() => void react(comment)} className={comment.likedByMe ? "comment-action active" : "comment-action"}>♥ {comment.score}</button>
        {!nested && settings.repliesEnabled ? <button type="button" className="comment-action" onClick={() => setReplyTo(comment.id)}>Reply</button> : null}
        {comment.mine ? <button type="button" className="comment-action danger" onClick={() => void remove(comment.id)}>Delete</button> : <details className="comment-more"><summary>More</summary><button type="button" onClick={() => void report(comment, "report")}>Report</button><button type="button" onClick={() => void report(comment, "mute")}>Mute user</button><button type="button" onClick={() => void report(comment, "block")}>Block user</button></details>}
      </footer>
      {(replies.get(comment.id) ?? []).map((reply) => <CommentCard comment={reply} nested key={reply.id} />)}
    </article>;
  }

  return <section className="comments-section" aria-labelledby="comments-heading">
    <div className="section-heading"><div><span className="eyebrow">Community</span><h2 id="comments-heading">Comments</h2></div><span className="comment-count">{comments.length}</span></div>
    {!settings.commentsEnabled ? <p className="policy-notice">Comments are disabled for this title.</p> : <form className="comment-form" onSubmit={submit}>
      {replyTo ? <div className="reply-banner">Replying to a comment <button type="button" onClick={() => setReplyTo(null)}>Cancel</button></div> : null}
      <label><span className="sr-only">Comment</span><textarea name="body" rows={3} minLength={2} maxLength={1000} required placeholder="Add to the conversation…" /></label>
      <div className="comment-form-actions"><select name="language" defaultValue="en" aria-label="Comment language"><option value="en">English</option><option value="ur">اردو</option><option value="roman_ur">Roman Urdu</option><option value="multi">Mixed</option></select><button className="button button-primary" disabled={busy || !contentId} type="submit">{busy ? "Posting…" : replyTo ? "Post reply" : "Post comment"}</button></div>
      <small>Be respectful. Spam, abuse and rights violations can be reported. Slow mode: {settings.slowModeSeconds}s.</small>
    </form>}
    {message ? <p className="policy-notice" role="status">{message}</p> : null}
    <div className="comments-list">{roots.length ? roots.map((comment) => <CommentCard comment={comment} key={comment.id} />) : <div className="empty-state"><h3>Start the conversation</h3><p>Sign in and share something useful.</p><Link className="button button-secondary" href="/login">Sign in</Link></div>}</div>
  </section>;
}
