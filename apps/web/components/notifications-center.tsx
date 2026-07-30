"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

type Item = { id: string; kind: string; actor: string; readAt: string | null; createdAt: string; content?: { slug?: string; title_en?: string } | null };
const copy: Record<string, string> = { comment_reply: "replied to your comment", comment_like: "liked your comment", moderation: "sent a moderation update", followed_content: "has an update" };

export function NotificationsCenter({ preview = false }: { preview?: boolean }) {
  const [items, setItems] = useState<Item[]>(preview ? [{ id: "preview-1", kind: "comment_reply", actor: "Ayesha", readAt: null, createdAt: "2026-07-30T20:00:00.000Z", content: { slug: "neural-network-visual-introduction", title_en: "But what is a neural network?" } }] : []);
  const [error, setError] = useState("");

  useEffect(() => {
    if (preview) return;
    const controller = new AbortController();
    void fetch("/api/notifications", { cache: "no-store", signal: controller.signal })
      .then(async (response) => ({ response, data: await response.json() }))
      .then(({ response, data }) => {
        if (response.status === 401) { window.location.href = "/login?next=/notifications"; return; }
        if (response.ok) setItems(data.items ?? []); else setError(data.error ?? "Notifications unavailable.");
      })
      .catch((reason: unknown) => { if (!(reason instanceof DOMException && reason.name === "AbortError")) setError("Notifications unavailable."); });
    return () => controller.abort();
  }, [preview]);

  async function refresh() {
    const response = await fetch("/api/notifications", { cache: "no-store" });
    if (response.status === 401) { window.location.href = "/login?next=/notifications"; return; }
    const data = await response.json();
    if (response.ok) setItems(data.items ?? []); else setError(data.error ?? "Notifications unavailable.");
  }

  async function read(id?: string) {
    if (preview) { setItems((current) => current.map((item) => ({ ...item, readAt: new Date().toISOString() }))); return; }
    await fetch("/api/notifications", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(id ? { id } : { all: true }) });
    await refresh();
  }

  return <div className="notifications-center"><div className="section-heading"><div><span className="eyebrow">Updates</span><h1>Notifications</h1></div><button className="button button-secondary" type="button" onClick={() => void read()} disabled={!items.some((item) => !item.readAt)}>Mark all read</button></div>{error ? <p className="policy-notice">{error}</p> : null}<div className="notification-list">{items.length ? items.map((item) => <article className={item.readAt ? "notification-card" : "notification-card unread"} key={item.id}><div><strong>{item.actor}</strong> {copy[item.kind] ?? "sent an update"}. {item.content?.title_en ? <Link href={`/watch/${item.content.slug}`}>{item.content.title_en}</Link> : null}<time>{new Date(item.createdAt).toLocaleString("en-PK")}</time></div>{!item.readAt ? <button type="button" onClick={() => void read(item.id)}>Mark read</button> : null}</article>) : <div className="empty-state"><h2>You are all caught up</h2><p>Replies, reactions and moderation updates will appear here.</p></div>}</div></div>;
}
