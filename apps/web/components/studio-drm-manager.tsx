"use client";

import { FormEvent, useState } from "react";

type Policy = { id: string; name: string; key_systems: string[]; minimum_security_level: string };
type MediaAsset = { id: string; storage_key: string; status: string; kind: string };
type Content = { id: string; slug: string; title_en: string; access_level: string; status: string; media_assets?: MediaAsset[]; rights_records?: Array<{ id: string; status: string }> };
type DrmAsset = { id: string; content_id: string; status: string; provider: string; key_id?: string | null; manifest_hls_path?: string | null; updated_at: string; content_items?: { title_en?: string; slug?: string } | null; drm_policies?: { name?: string } | null; packaging_metadata?: Record<string, unknown> };
type Event = { id: number; drm_asset_id: string; key_system: string; status: string; reason?: string | null; request_id: string; response_ms?: number | null; created_at: string };
type Readiness = { enabled: boolean; packagingKey: boolean; widevine: boolean; fairplay: boolean };

export function StudioDrmManager({ initialAssets, initialContent, policies, licenceEvents, readiness }: { initialAssets: DrmAsset[]; initialContent: Content[]; policies: Policy[]; licenceEvents: Event[]; readiness: Readiness }) {
  const [assets, setAssets] = useState(initialAssets);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function reload() {
    const response = await fetch("/api/studio/drm", { cache: "no-store" }); const data = await response.json(); if (response.ok) setAssets(data.assets ?? []);
  }

  async function queue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/studio/drm", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ contentId: form.get("contentId"), mediaAssetId: form.get("mediaAssetId"), policyId: form.get("policyId"), provider: form.get("provider") }) });
    const data = await response.json();
    setMessage(response.ok ? "DRM packaging queued. The worker will create encrypted HLS and DASH manifests." : data.error ?? "DRM packaging could not be queued.");
    if (response.ok) { event.currentTarget.reset(); await reload(); }
    setBusy(false);
  }

  async function action(asset: DrmAsset, name: "retry" | "revoke" | "restore") {
    const method = name === "retry" ? "POST" : "PATCH";
    const response = await fetch("/api/studio/drm", { method, headers: { "content-type": "application/json" }, body: JSON.stringify(name === "retry" ? { action: name, drmAssetId: asset.id } : { action: name, drmAssetId: asset.id }) });
    const data = await response.json(); setMessage(response.ok ? `DRM ${name} accepted.` : data.error ?? "DRM action failed."); if (response.ok) await reload();
  }

  const eligible = initialContent.filter((content) => content.rights_records?.some((record) => record.status === "approved") && content.media_assets?.some((asset) => asset.status === "ready"));
  return <div className="studio-drm-manager">
    <section className="studio-panel drm-readiness"><h2>Provider readiness</h2><div className="readiness-grid"><Status label="Web DRM enabled" ready={readiness.enabled} /><Status label="Packaging key service" ready={readiness.packagingKey} /><Status label="Widevine licence service" ready={readiness.widevine} /><Status label="FairPlay licence + certificate" ready={readiness.fairplay} /></div><p>No plaintext keys, licence challenges or licence responses are stored by Jalwa.</p></section>
    <section className="studio-panel"><h2>Queue protected packaging</h2><form className="drm-queue-form" onSubmit={queue}><label>Content<select name="contentId" required defaultValue=""><option value="" disabled>Select rights-approved content</option>{eligible.map((content) => <option value={content.id} key={content.id}>{content.title_en} · {content.access_level}</option>)}</select></label><label>Source asset<select name="mediaAssetId" required defaultValue=""><option value="" disabled>Select ready source asset</option>{eligible.flatMap((content) => (content.media_assets ?? []).filter((asset) => asset.status === "ready").map((asset) => <option value={asset.id} key={asset.id}>{content.title_en} · {asset.kind} · {asset.storage_key}</option>))}</select></label><label>Policy<select name="policyId" required defaultValue={policies[0]?.id}>{policies.map((policy) => <option value={policy.id} key={policy.id}>{policy.name} · {policy.minimum_security_level}</option>)}</select></label><label>Provider<select name="provider" defaultValue="widevine_fairplay_proxy"><option value="widevine_fairplay_proxy">Jalwa Widevine/FairPlay proxy</option><option value="external_multi_drm">External multi-DRM</option></select></label><button className="button button-primary" disabled={busy || !readiness.enabled}>{busy ? "Queueing…" : "Queue DRM packaging"}</button></form></section>
    {message ? <p className="policy-notice" role="status">{message}</p> : null}
    <section className="studio-panel"><h2>Protected assets</h2><div className="drm-asset-list">{assets.length ? assets.map((asset) => <article key={asset.id}><header><div><strong>{asset.content_items?.title_en ?? asset.content_id}</strong><small>{asset.provider} · {asset.drm_policies?.name ?? "policy"}</small></div><span>{asset.status}</span></header><p>{asset.manifest_hls_path ? `HLS: ${asset.manifest_hls_path}` : "Encrypted manifest pending."}</p><small>Updated {new Date(asset.updated_at).toLocaleString("en-PK")}{asset.key_id ? ` · Key ID ${asset.key_id}` : ""}</small><div className="admin-actions">{asset.status === "failed" ? <button className="button button-secondary" onClick={() => void action(asset,"retry")}>Retry</button> : null}{asset.status === "ready" ? <button className="button button-secondary" onClick={() => void action(asset,"revoke")}>Revoke</button> : null}{asset.status === "revoked" ? <button className="button button-secondary" onClick={() => void action(asset,"restore")}>Restore</button> : null}</div></article>) : <p>No DRM assets yet.</p>}</div></section>
    {licenceEvents.length ? <section className="studio-panel"><h2>Recent licence diagnostics</h2><div className="licence-event-list">{licenceEvents.map((item) => <article key={item.id}><strong>{item.key_system}</strong><span>{item.status}</span><code>{item.request_id}</code><small>{item.response_ms ?? "—"} ms · {new Date(item.created_at).toLocaleString("en-PK")}{item.reason ? ` · ${item.reason}` : ""}</small></article>)}</div></section> : null}
  </div>;
}

function Status({ label, ready }: { label: string; ready: boolean }) { return <article className={ready ? "ready" : "not-ready"}><strong>{ready ? "Ready" : "Not configured"}</strong><span>{label}</span></article>; }
