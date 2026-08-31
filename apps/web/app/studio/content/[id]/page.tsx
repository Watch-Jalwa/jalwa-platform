import { notFound } from "next/navigation";
import {
  approveRightsAction,
  publishContentAction,
  setLiveSourceEnabledAction,
  submitRightsReviewAction,
  unpublishContentAction,
  updateRightsAction,
} from "@/app/studio/actions";
import { MediaUploader } from "@/components/media-uploader";
import { requireStaff } from "@/lib/studio/auth";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ error?: string }>;

function isFutureReview(value: string | null | undefined) {
  if (!value) return false;
  return new Date(value).getTime() > new Date().getTime();
}

export default async function StudioContentDetailPage({ params, searchParams }: { params: Params; searchParams: SearchParams }) {
  const [{ id }, { error }] = await Promise.all([params, searchParams]);
  const { database, profile } = await requireStaff();
  const [{ data: item }, { data: rights }, { data: playback }, { data: assets }] = await Promise.all([
    database.from("content_items").select("id,slug,title_en,title_ur,status,content_type,hosting_mode,access_level,description_en").eq("id", id).maybeSingle(),
    database.from("rights_records").select("id,status,source_url,creator,licence_code,attribution_text,evidence_url,evidence_note,takedown_contact,expires_at,review_notes,embedding_confirmed,self_hosting_confirmed,commercial_use_confirmed,modification_confirmed,verified_at").eq("content_id", id).maybeSingle(),
    database.from("playback_sources").select("id,provider,external_url,format,status").eq("content_id", id).eq("is_primary", true).maybeSingle(),
    database.from("media_assets").select("id,kind,status,size_bytes,created_at").eq("content_id", id).order("created_at", { ascending: false }).limit(10),
  ]);
  if (!item) notFound();
  const { data: liveConfig } = playback?.id
    ? await database.from("live_source_configs").select("source_key,delivery_adapter,official_source_url,terms_url,required_attribution,rights_verified_at,next_review_at,enabled,operations_owner").eq("playback_source_id", playback.id).maybeSingle()
    : { data: null };

  const canApprove = profile.role === "rights_reviewer" || profile.role === "admin";
  const selfHosted = ["self_host_open", "self_host_owned"].includes(item.hosting_mode);
  const expiryDate = rights?.expires_at ? rights.expires_at.slice(0, 10) : "";
  const liveReviewCurrent = !liveConfig || Boolean(liveConfig.rights_verified_at && isFutureReview(liveConfig.next_review_at));
  const canPublish = rights?.status === "approved" && item.status !== "published" && (!liveConfig || (liveConfig.enabled && liveReviewCurrent));

  return <div>
    <div className="section-heading"><div><span className="eyebrow">{item.status}</span><h1>{item.title_en}</h1></div></div>
    {error ? <p className="form-message">{error}</p> : null}

    <div className="studio-grid">
      <section className="panel">
        <h2>Catalogue record</h2>
        <dl className="detail-list">
          <div><dt>Slug</dt><dd>{item.slug}</dd></div>
          <div><dt>Type</dt><dd>{item.content_type}</dd></div>
          <div><dt>Hosting</dt><dd>{item.hosting_mode}</dd></div>
          <div><dt>Access</dt><dd>{item.access_level}</dd></div>
          <div><dt>Provider</dt><dd>{playback?.provider ?? "Not assigned"}</dd></div>
          <div><dt>Playback</dt><dd>{playback?.format ?? playback?.status ?? "Not ready"}</dd></div>
        </dl>
      </section>

      <section className="panel">
        <h2>Rights decision</h2>
        {rights ? <dl className="detail-list">
          <div><dt>Status</dt><dd>{rights.status}</dd></div>
          <div><dt>Verified</dt><dd>{rights.verified_at ? new Date(rights.verified_at).toLocaleString("en-PK") : "Not verified"}</dd></div>
          <div><dt>Expiry</dt><dd>{rights.expires_at ? new Date(rights.expires_at).toLocaleDateString("en-PK") : "No recorded expiry"}</dd></div>
          <div><dt>Embed</dt><dd>{rights.embedding_confirmed ? "Confirmed" : "No"}</dd></div>
          <div><dt>Self-host</dt><dd>{rights.self_hosting_confirmed ? "Confirmed" : "No"}</dd></div>
          <div><dt>Commercial</dt><dd>{rights.commercial_use_confirmed ? "Confirmed" : "No"}</dd></div>
        </dl> : <p>No rights record exists.</p>}
      </section>

      {liveConfig ? <section className="panel">
        <span className="eyebrow">Allowlisted live source</span>
        <h2>Live delivery control</h2>
        <dl className="detail-list">
          <div><dt>Source key</dt><dd>{liveConfig.source_key}</dd></div>
          <div><dt>Adapter</dt><dd>{liveConfig.delivery_adapter}</dd></div>
          <div><dt>Enabled</dt><dd>{liveConfig.enabled ? "Yes" : "No"}</dd></div>
          <div><dt>Review</dt><dd>{liveConfig.next_review_at ? new Date(liveConfig.next_review_at).toLocaleDateString("en-PK") : "Not reviewed"}</dd></div>
          <div><dt>Owner</dt><dd>{liveConfig.operations_owner}</dd></div>
        </dl>
        <p>Approval records a 90-day terms recheck. Enabling is separate from rights approval and the environment feature flag remains an additional production gate.</p>
        {canApprove && rights?.status === "approved" ? <form action={setLiveSourceEnabledAction}>
          <input name="id" type="hidden" value={id} />
          <input name="enabled" type="hidden" value={liveConfig.enabled ? "false" : "true"} />
          <button className="button button-secondary" type="submit">{liveConfig.enabled ? "Disable live source" : "Enable reviewed live source"}</button>
        </form> : null}
      </section> : null}

      {rights ? <form className="panel" action={updateRightsAction}>
        <span className="eyebrow">Fail-closed record</span>
        <h2>Rights evidence and permissions</h2>
        <p>Saving changes resets approval and disables an associated live source until another review is completed.</p>
        <input name="id" type="hidden" value={id} />
        <input name="rightsId" type="hidden" value={rights.id} />
        <label className="form-field"><span>Original source URL</span><input name="sourceUrl" type="url" defaultValue={rights.source_url} required /></label>
        <label className="form-field"><span>Source organisation or creator</span><input name="creator" defaultValue={rights.creator ?? ""} required /></label>
        <label className="form-field"><span>Licence or permission basis</span><input name="licenceCode" defaultValue={rights.licence_code ?? ""} required /></label>
        <label className="form-field"><span>Attribution text</span><textarea name="attributionText" defaultValue={rights.attribution_text ?? ""} required /></label>
        <label className="form-field"><span>Evidence URL</span><input name="evidenceUrl" type="url" defaultValue={rights.evidence_url ?? ""} placeholder="https://..." /></label>
        <label className="form-field"><span>Evidence note or internal reference</span><textarea name="evidenceNote" defaultValue={rights.evidence_note ?? ""} /></label>
        <label className="form-field"><span>Takedown contact</span><input name="takedownContact" defaultValue={rights.takedown_contact ?? ""} placeholder="rights@example.org or case owner" required /></label>
        <label className="form-field"><span>Rights expiry</span><input name="expiresAt" type="date" defaultValue={expiryDate} /></label>
        <label className="form-field"><span>Reviewer notes</span><textarea name="reviewNotes" defaultValue={rights.review_notes ?? ""} /></label>
        <label className="form-field"><span><input name="embeddingConfirmed" type="checkbox" defaultChecked={rights.embedding_confirmed} /> Embedding is permitted</span></label>
        <label className="form-field"><span><input name="selfHostingConfirmed" type="checkbox" defaultChecked={rights.self_hosting_confirmed} /> Rehosting is permitted</span></label>
        <label className="form-field"><span><input name="commercialUseConfirmed" type="checkbox" defaultChecked={rights.commercial_use_confirmed} /> Commercial use is permitted</span></label>
        <label className="form-field"><span><input name="modificationConfirmed" type="checkbox" defaultChecked={rights.modification_confirmed} /> Modification is permitted</span></label>
        <button className="button button-primary" type="submit">Save rights record</button>
      </form> : null}

      {selfHosted ? <section className="panel"><h2>Media processing</h2><MediaUploader contentId={id} /><div className="asset-list">{(assets ?? []).map((asset) => <div key={asset.id}><span>{asset.kind}</span><strong>{asset.status}</strong></div>)}</div></section> : null}
    </div>

    <div className="action-row">
      {["draft", "unavailable"].includes(item.status) ? <form action={submitRightsReviewAction}><input name="id" type="hidden" value={id} /><button className="button button-secondary" type="submit">Submit for rights review</button></form> : null}
      {canApprove && rights?.status === "pending" ? <form action={approveRightsAction}><input name="id" type="hidden" value={id} /><input name="rightsId" type="hidden" value={rights.id} /><button className="button button-secondary" type="submit">Approve complete rights record</button></form> : null}
      {canPublish ? <form action={publishContentAction}><input name="id" type="hidden" value={id} /><button className="button button-primary" type="submit">Publish</button></form> : null}
      {rights?.status === "approved" && item.status !== "published" && liveConfig && !canPublish ? <p className="form-message">Enable the reviewed live source before publishing.</p> : null}
      {item.status === "published" ? <form action={unpublishContentAction}><input name="id" type="hidden" value={id} /><input name="reason" type="hidden" value="Manual Studio takedown" /><button className="button button-secondary" type="submit">Unpublish immediately</button></form> : null}
    </div>
  </div>;
}
