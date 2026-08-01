import {
  setAlphaAccessGrantAction,
  setContentAvailabilityAction,
  setInternalAlphaStateAction,
  setRightsHoldAction,
  setSourceAvailabilityAction,
  reviewSourceItemAction,
  promoteSourceItemAction,
} from "@/app/studio/alpha/actions";
import { requireStaff } from "@/lib/studio/auth";

export const metadata = { title: "Internal Alpha" };
export const dynamic = "force-dynamic";

type SearchParams = Promise<{ error?: string }>;

function dateLabel(value: string | null | undefined) {
  return value ? new Date(value).toLocaleDateString("en-PK") : "No expiry";
}

export default async function InternalAlphaPage({ searchParams }: { searchParams: SearchParams }) {
  const { error } = await searchParams;
  const { supabase, profile } = await requireStaff();
  const canAdmin = profile.role === "admin";
  const canReview = ["rights_reviewer", "admin"].includes(profile.role);

  const [
    { data: flags },
    { data: sources },
    { data: items },
    { data: rights },
    { data: grants },
    { data: candidates },
  ] = await Promise.all([
    supabase.from("platform_runtime_flags").select("key,enabled,notes,updated_at").in("key", ["internal_alpha_enabled", "internal_alpha_invite_only"]),
    supabase.from("source_accounts")
      .select("id,source_key,provider,name,content_lane,primary_media,accepted_rights_basis,item_level_check_required,is_enabled,next_review_at,disabled_reason")
      .order("provider")
      .order("name")
      .limit(200),
    supabase.from("content_items")
      .select("id,title_en,status,hosting_mode,is_available,disabled_reason,source_account_id")
      .in("status", ["published", "scheduled", "editorial_review", "rights_review", "unavailable"])
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase.from("rights_records")
      .select("content_id,status,rights_hold,rights_hold_reason,expires_at")
      .limit(500),
    supabase.from("alpha_access_grants")
      .select("user_id,enabled,expires_at,reason,granted_at,revoked_at")
      .order("updated_at", { ascending: false })
      .limit(100),
    supabase.from("source_items")
      .select("id,source_account_id,title,creator,licence_code,source_url,media_type,language,rights_state,ingestion_status,content_id,discovered_at")
      .neq("ingestion_status", "rejected")
      .order("discovered_at", { ascending: false })
      .limit(100),
  ]);

  const flagMap = new Map((flags ?? []).map((row) => [row.key, row.enabled]));
  const sourceMap = new Map((sources ?? []).map((row) => [row.id, row]));
  const rightsMap = new Map((rights ?? []).map((row) => [row.content_id, row]));
  const alphaEnabled = flagMap.get("internal_alpha_enabled") === true;
  const inviteOnly = flagMap.get("internal_alpha_invite_only") !== false;
  const enabledSources = (sources ?? []).filter((row) => row.is_enabled).length;
  const enabledItems = (items ?? []).filter((row) => row.is_available).length;
  const activeGrants = (grants ?? []).filter((row) => row.enabled).length;

  return (
    <div className="studio-page">
      <div className="section-heading">
        <div>
          <span className="eyebrow">Controlled release</span>
          <h1>Internal alpha</h1>
          <p>Source approval permits discovery. Each item still requires current rights, ready playback, editorial publication and an explicit availability decision.</p>
        </div>
      </div>

      {error ? <p className="form-message">{error}</p> : null}

      <div className="operations-grid">
        <article className="operation-card"><strong>{alphaEnabled ? "ON" : "OFF"}</strong><span>Alpha runtime</span></article>
        <article className="operation-card"><strong>{inviteOnly ? "Invite only" : "Authenticated"}</strong><span>Access mode</span></article>
        <article className="operation-card"><strong>{enabledSources}/{sources?.length ?? 0}</strong><span>Enabled sources</span></article>
        <article className="operation-card"><strong>{enabledItems}/{items?.length ?? 0}</strong><span>Available recent items</span></article>
        <article className="operation-card"><strong>{activeGrants}</strong><span>Enabled tester grants</span></article>
      </div>

      <section className="account-card">
        <span className="eyebrow">Global gate</span>
        <h2>Alpha runtime state</h2>
        <p>When disabled, only staff can preview the catalogue. When enabled and invite-only, an authenticated user also needs an active grant.</p>
        {alphaEnabled && canAdmin ? (
          <form action={setInternalAlphaStateAction}>
            <input name="enabled" type="hidden" value="false" />
            <input name="inviteOnly" type="hidden" value="true" />
            <input name="reason" type="hidden" value="Emergency or planned internal alpha shutdown." />
            <button className="button button-primary" type="submit">Emergency disable alpha</button>
          </form>
        ) : null}
        {!alphaEnabled ? <p>Activation is only available through the protected <strong>Set internal alpha</strong> workflow after exact-SHA, source, content and tester gates pass.</p> : null}
        {!canAdmin ? <p>Administrator access is required for emergency shutdown.</p> : null}
      </section>

      <section className="account-card">
        <span className="eyebrow">Invite list</span>
        <h2>Tester access</h2>
        {canAdmin ? (
          <form className="studio-form" action={setAlphaAccessGrantAction}>
            <label className="form-field"><span>User UUID</span><input name="userId" required placeholder="00000000-0000-0000-0000-000000000000" /></label>
            <label className="form-field"><span>Expiry</span><input name="expiresAt" type="date" /></label>
            <label className="form-field"><span>Reason</span><input name="reason" required defaultValue="Approved internal alpha tester." /></label>
            <input name="enabled" type="hidden" value="true" />
            <button className="button button-primary" type="submit">Grant alpha access</button>
          </form>
        ) : null}
        <div className="asset-list">
          {(grants ?? []).map((grant) => (
            <div key={grant.user_id}>
              <span><strong>{grant.user_id}</strong><br />{grant.reason} · {dateLabel(grant.expires_at)}</span>
              <span>{grant.enabled ? "Active" : "Revoked"}</span>
              {canAdmin && grant.enabled ? (
                <form action={setAlphaAccessGrantAction}>
                  <input name="userId" type="hidden" value={grant.user_id} />
                  <input name="enabled" type="hidden" value="false" />
                  <input name="reason" type="hidden" value="Tester access revoked by administrator." />
                  <button className="button button-secondary" type="submit">Revoke</button>
                </form>
              ) : null}
            </div>
          ))}
          {!grants?.length ? <p>No tester grants have been created.</p> : null}
        </div>
      </section>

      <section className="account-card">
        <span className="eyebrow">Rights-first allowlist</span>
        <h2>Approved source lanes</h2>
        <p>All 151 owner-approved lanes are installed as source-level discovery permissions. Item-level rights checks remain mandatory wherever the source row says they are required.</p>
        <div className="asset-list">
          {(sources ?? []).map((source) => (
            <div key={source.id}>
              <span>
                <strong>{source.source_key} · {source.name}</strong><br />
                {source.provider} · {source.content_lane} · {source.primary_media}<br />
                {source.accepted_rights_basis} · Review: {dateLabel(source.next_review_at)}
                {source.item_level_check_required ? " · Item review required" : ""}
                {source.disabled_reason ? ` · ${source.disabled_reason}` : ""}
              </span>
              <span>{source.is_enabled ? "Enabled" : "Disabled"}</span>
              {canReview ? (
                <form action={setSourceAvailabilityAction}>
                  <input name="sourceId" type="hidden" value={source.id} />
                  <input name="enabled" type="hidden" value={source.is_enabled ? "false" : "true"} />
                  <input name="reason" type="hidden" value={source.is_enabled ? "Source disabled for copyright or operational review." : "Approved source restored after review."} />
                  <button className="button button-secondary" type="submit">{source.is_enabled ? "Disable source" : "Enable source"}</button>
                </form>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section className="account-card">
        <span className="eyebrow">Metadata intake</span>
        <h2>Source candidate review queue</h2>
        <p>Harvesting creates metadata candidates only. A rights reviewer must approve the exact item before staff can create a governed content draft. Promotion never publishes. Approved video drafts enter a blocked download queue that starts only after the content rights record is separately approved.</p>
        <div className="asset-list">
          {(candidates ?? []).map((candidate) => {
            const source = sourceMap.get(candidate.source_account_id);
            const videoCandidate = ["video", "animation"].includes(candidate.media_type ?? "");
            const contentType = videoCandidate ? "video" : candidate.media_type === "audio" ? "audio" : "image_story";
            const hostingMode = videoCandidate ? "self_host_open" : "external_link";
            return (
              <div key={candidate.id}>
                <span>
                  <strong>{candidate.title}</strong><br />
                  {source?.source_key ?? "Unknown source"} · {candidate.media_type ?? "media"} · {candidate.language ?? "unknown language"}<br />
                  {candidate.creator ?? "Unknown creator"} · {candidate.licence_code ?? "Missing licence"} · {candidate.rights_state}/{candidate.ingestion_status}
                </span>
                <div className="action-row">
                  {canReview && candidate.ingestion_status !== "approved" && !candidate.content_id ? (
                    <>
                      <form action={reviewSourceItemAction}>
                        <input name="sourceItemId" type="hidden" value={candidate.id} />
                        <input name="decision" type="hidden" value="approve" />
                        <input name="reason" type="hidden" value="Item-level provenance and commercially compatible licence verified." />
                        <button className="button button-secondary" type="submit">Approve item</button>
                      </form>
                      <form action={reviewSourceItemAction}>
                        <input name="sourceItemId" type="hidden" value={candidate.id} />
                        <input name="decision" type="hidden" value="reject" />
                        <input name="reason" type="hidden" value="Item rights or provenance are not sufficient for Jalwa." />
                        <button className="button button-secondary" type="submit">Reject item</button>
                      </form>
                    </>
                  ) : null}
                  {candidate.ingestion_status === "approved" && !candidate.content_id ? (
                    <form action={promoteSourceItemAction}>
                      <input name="sourceItemId" type="hidden" value={candidate.id} />
                      <input name="categorySlug" type="hidden" value="learn" />
                      <input name="contentType" type="hidden" value={contentType} />
                      <input name="hostingMode" type="hidden" value={hostingMode} />
                      <button className="button button-primary" type="submit">Create governed draft</button>
                    </form>
                  ) : null}
                  {candidate.content_id ? <span>Draft created</span> : null}
                </div>
              </div>
            );
          })}
          {!candidates?.length ? <p>No harvested candidates are waiting for review.</p> : null}
        </div>
      </section>

      <section className="account-card">
        <span className="eyebrow">Immediate kill switch</span>
        <h2>Content availability and rights holds</h2>
        <p>Disabling an item removes it from catalogue queries and blocks new playback sessions without deleting retained evidence or private media.</p>
        <div className="asset-list">
          {(items ?? []).map((item) => {
            const itemRights = rightsMap.get(item.id);
            const source = item.source_account_id ? sourceMap.get(item.source_account_id) : null;
            return (
              <div key={item.id}>
                <span>
                  <strong>{item.title_en}</strong><br />
                  {item.status} · {item.hosting_mode} · {source?.source_key ?? "No source link"}
                  {itemRights?.status ? ` · Rights ${itemRights.status}` : " · No rights record"}
                  {itemRights?.expires_at ? ` · Expires ${dateLabel(itemRights.expires_at)}` : ""}
                  {itemRights?.rights_hold ? ` · HOLD: ${itemRights.rights_hold_reason ?? "Review required"}` : ""}
                  {item.disabled_reason ? ` · ${item.disabled_reason}` : ""}
                </span>
                <span>{item.is_available ? "Available" : "Unavailable"}</span>
                <div className="action-row">
                  <form action={setContentAvailabilityAction}>
                    <input name="contentId" type="hidden" value={item.id} />
                    <input name="enabled" type="hidden" value={item.is_available ? "false" : "true"} />
                    <input name="reason" type="hidden" value={item.is_available ? "Content disabled from internal alpha." : "Content enabled after rights, playback and editorial validation."} />
                    <button className="button button-secondary" type="submit">{item.is_available ? "Disable item" : "Enable item"}</button>
                  </form>
                  {canReview ? (
                    <form action={setRightsHoldAction}>
                      <input name="contentId" type="hidden" value={item.id} />
                      <input name="hold" type="hidden" value={itemRights?.rights_hold ? "false" : "true"} />
                      <input name="reason" type="hidden" value={itemRights?.rights_hold ? "Rights hold released after documented review." : "Immediate copyright review required."} />
                      <button className="button button-secondary" type="submit">{itemRights?.rights_hold ? "Release hold" : "Apply rights hold"}</button>
                    </form>
                  ) : null}
                </div>
              </div>
            );
          })}
          {!items?.length ? <p>No catalogue items are ready for alpha operations.</p> : null}
        </div>
      </section>
    </div>
  );
}
