"use client";

import { FormEvent, useState } from "react";

type Event = { id: string; title_en: string; scheduled_start: string; status: string };
type Channel = { id: string; slug: string; title_en: string; status: string; provider: string; access_level: string; is_published: boolean; provider_input_id?: string | null; live_events?: Event[] };
type Ingest = { rtmpsUrl?: string | null; rtmpsKey?: string | null; srtUrl?: string | null; srtStreamId?: string | null; srtPassphrase?: string | null };

export function StudioLiveManager({ initialChannels }: { initialChannels: Channel[] }) {
  const [channels, setChannels] = useState(initialChannels);
  const [ingest, setIngest] = useState<Ingest | null>(null);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    const response = await fetch("/api/studio/live", { cache: "no-store" }); const data = await response.json(); if (response.ok) setChannels(data.channels ?? []);
  }

  async function createChannel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage(""); setIngest(null);
    const form = new FormData(event.currentTarget);
    const payload = { slug: form.get("slug"), title: form.get("title"), titleUrdu: form.get("titleUrdu"), description: form.get("description"), provider: form.get("provider"), accessLevel: form.get("accessLevel"), recording: form.get("recording") === "on", lowLatency: form.get("lowLatency") === "on", playbackHlsUrl: form.get("playbackHlsUrl"), publish: form.get("publish") === "on" };
    const response = await fetch("/api/studio/live", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(payload) });
    const data = await response.json();
    if (!response.ok) setMessage(data.error ?? "Channel could not be created."); else { setIngest(data.ingest ?? null); setMessage(data.warning ?? "Channel created."); event.currentTarget.reset(); await reload(); }
    setBusy(false);
  }

  async function channelAction(channel: Channel, patch: Record<string, unknown>) {
    const response = await fetch("/api/studio/live", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ id: channel.id, ...patch }) });
    const data = await response.json(); setMessage(response.ok ? "Channel updated." : data.error ?? "Update failed."); if (response.ok) await reload();
  }

  async function status(channel: Channel) {
    const response = await fetch(`/api/studio/live?id=${encodeURIComponent(channel.id)}`, { cache: "no-store" }); const data = await response.json(); setMessage(response.ok ? `Provider status: ${data.provider?.status ?? data.channel?.status}` : data.error ?? "Status unavailable."); if (response.ok) await reload();
  }

  async function schedule(event: FormEvent<HTMLFormElement>, channelId: string) {
    event.preventDefault(); const form = new FormData(event.currentTarget);
    const response = await fetch("/api/studio/live/events", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ channelId, title: form.get("title"), titleUrdu: form.get("titleUrdu"), description: form.get("description"), scheduledStart: form.get("scheduledStart"), scheduledEnd: form.get("scheduledEnd") || null, publish: true }) });
    const data = await response.json(); setMessage(response.ok ? "Programme scheduled." : data.error ?? "Programme could not be scheduled."); if (response.ok) { event.currentTarget.reset(); await reload(); }
  }

  return <div className="studio-live-manager">
    <section className="studio-panel"><h2>Create a live channel</h2><form className="studio-live-form" onSubmit={createChannel}><label>Slug<input name="slug" pattern="[a-z0-9]+(?:-[a-z0-9]+)*" required /></label><label>English title<input name="title" required /></label><label>Urdu title<input name="titleUrdu" dir="rtl" /></label><label>Description<textarea name="description" rows={3} /></label><label>Provider<select name="provider" defaultValue="cloudflare_stream"><option value="cloudflare_stream">Cloudflare Stream</option><option value="self_hosted">Self-hosted HLS</option><option value="external">External HLS</option></select></label><label>Access<select name="accessLevel" defaultValue="public"><option value="public">Public</option><option value="registered">Registered</option><option value="premium">Premium</option></select></label><label>External/self-hosted HLS URL<input name="playbackHlsUrl" type="url" /></label><label><input name="recording" type="checkbox" defaultChecked /> Record broadcasts</label><label><input name="lowLatency" type="checkbox" /> Prefer low latency</label><label><input name="publish" type="checkbox" /> Publish immediately</label><button className="button button-primary" disabled={busy}>{busy ? "Creating…" : "Create channel"}</button></form></section>
    {ingest ? <section className="studio-panel ingest-credentials"><h2>Copy ingest credentials now</h2><p>Jalwa does not store these secrets. Put them directly into OBS or the broadcaster encoder.</p>{Object.entries(ingest).filter(([,value]) => value).map(([key,value]) => <label key={key}>{key}<div><code>{value}</code><button type="button" onClick={() => void navigator.clipboard.writeText(String(value))}>Copy</button></div></label>)}</section> : null}
    {message ? <p className="policy-notice" role="status">{message}</p> : null}
    <section className="studio-panel"><h2>Channels</h2><div className="live-admin-list">{channels.map((channel) => <article key={channel.id}><header><div><strong>{channel.title_en}</strong><small>{channel.slug} · {channel.provider} · {channel.access_level}</small></div><span>{channel.status}</span></header><div className="admin-actions"><button className="button button-secondary" type="button" onClick={() => void status(channel)}>Check status</button><button className="button button-secondary" type="button" onClick={() => void channelAction(channel, { publish: !channel.is_published })}>{channel.is_published ? "Unpublish" : "Publish"}</button><button className="button button-secondary" type="button" onClick={() => void channelAction(channel, { status: channel.status === "live" ? "ended" : "live" })}>{channel.status === "live" ? "End live" : "Mark live"}</button></div><form className="programme-form" onSubmit={(event) => void schedule(event,channel.id)}><h3>Schedule programme</h3><input name="title" placeholder="Programme title" required /><input name="titleUrdu" placeholder="Urdu title" dir="rtl" /><input name="scheduledStart" type="datetime-local" required /><input name="scheduledEnd" type="datetime-local" /><input name="description" placeholder="Description" /><button className="button button-secondary">Schedule</button></form><div className="programme-admin-list">{channel.live_events?.map((item) => <p key={item.id}><strong>{item.title_en}</strong> · {new Date(item.scheduled_start).toLocaleString("en-PK")} · {item.status}</p>)}</div></article>)}</div></section>
  </div>;
}
