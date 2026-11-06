import assert from "node:assert/strict";
import { createPool } from "/app/packages/postgres/index.mjs";

const env = process.env;
assert.equal(env.DEPLOYMENT_ENVIRONMENT, "staging");
assert.equal(env.MEDIA_BACKEND, "r2");
assert.equal(env.PAYMENT_PROVIDER, "mock");
assert.equal(env.JALWA_FOUR_MODE, "correct-licence");
assert.equal(env.JALWA_FOUR_SLUG, "cosmos-laundromat");
assert.match(env.JALWA_FOUR_RUN, /^[1-9]\d*-[1-9]\d*$/);
assert.match(env.JALWA_FOUR_EXPECTED_SHA, /^[a-f0-9]{40}$/);
assert.equal(env.GIT_SHA, env.JALWA_FOUR_EXPECTED_SHA);
const review = JSON.parse(env.JALWA_FOUR_REVIEWS)["cosmos-laundromat"];
assert.equal(review.licenceCode, "CC-BY-4.0");
assert.equal(review.licenceEvidence, "https://github.com/Watch-Jalwa/jalwa-platform/actions/runs/42188424728/artifacts/13489052274");
assert(review.attributionText.includes("Blender Foundation") && review.attributionText.includes("https://creativecommons.org/licenses/by/4.0/"));
const pool = createPool(env.DATABASE_URL, {max:1});
const db = await pool.connect();
const one = async (query, args) => {
  const result = await db.query(query, args);
  assert.equal(result.rowCount, 1);
  return result.rows[0];
};
try {
  await db.query("begin");
  await db.query("set local lock_timeout='8s'");
  await db.query("select pg_advisory_xact_lock(hashtext('jalwa-demo14-cosmos-laundromat'))");
  const c = await one(`select *, public.has_publishable_rights(id,hosting_mode,access_level) as rights_ok,
    public.is_content_processing_allowed(id) as processing_ok from public.content_items
    where slug='cosmos-laundromat' for update`);
  assert.equal(c.id, "7ff4cd3e-f6ba-4bf6-9f0b-4495392e012d");
  assert(c.rights_ok && c.processing_ok);
  const a = await one(`select * from public.media_assets where content_id=$1
    and id='c7c1a63f-dbbe-4866-970c-44730e9d85d8' and kind='source_video' and status='ready' for share`, [c.id]);
  assert.equal(a.metadata.sourceUrl, "https://video.blender.org/download/web-videos/f507dfdc-e73e-45a4-9778-d758cbe1ce96-480.mp4");
  assert.equal(Number(a.size_bytes), 110296781);
  assert.match(a.checksum, /^[a-f0-9]{64}$/);
  const before = await one(`select *, xmin::text as revision from public.rights_records where content_id=$1 and status='approved'
    and not rights_hold and self_hosting_confirmed and commercial_use_confirmed
    and verified_by is not null and verified_at is not null
    and (expires_at is null or expires_at>now()) for update`, [c.id]);
  assert.equal(before.source_url, review.sourcePage);
  const approved = await one(`select exists(select 1 from public.audit_logs
    where entity_id=$1::text and action='rights_approved' and actor_id is not null) as ok`, [c.id]);
  assert(approved.ok);
  if (before.licence_code === review.licenceCode) {
    assert.equal(before.attribution_text, review.attributionText);
    assert.equal(before.evidence_url, review.licenceEvidence);
    console.log("COSMOS_LICENCE_ALREADY_CORRECT", review.licenceCode);
  } else {
    assert.equal(before.licence_code, "CC-BY-3.0");
    const note = "Exact official original closing credit frame credit-028.jpg states Creative Commons Attribution 4.0. Verified in GitHub run 42188424728, artifact 13489052274. The older Gooseberry website default was CC BY 3.0. Owner-authorized completion and editorial review on 2026-11-06.";
    const after = await one(`update public.rights_records set licence_code=$2, attribution_text=$3,
      evidence_url=$4, evidence_note=concat_ws(E'\\n', nullif(evidence_note,''), $5)
      where id=$1 and licence_code='CC-BY-3.0' and status='approved' and not rights_hold
      and source_url=$6 and xmin::text=$7 returning *, xmin::text as revision`,
      [before.id, review.licenceCode, review.attributionText, review.licenceEvidence, note, before.source_url, before.revision]);
    for (const key of ["status","verified_by","verified_at","source_url","creator","commercial_use_confirmed",
      "self_hosting_confirmed","modification_confirmed","embedding_confirmed","rights_hold","expires_at"]) {
      assert.deepEqual(after[key], before[key], "Approval identity or permissions changed");
    }
    await db.query(`insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
      values(null,'demo_cosmos_licence_metadata_corrected','rights_record',$1,$2::jsonb)`,
      [before.id, JSON.stringify({contentId:c.id, slug:c.slug, scope:"shared-demo-only", run:env.JALWA_FOUR_RUN,
        release:env.GIT_SHA, authorization:"Owner request to ingest Cosmos, confirm editorial clearance and complete publication",
        rollbackPolicy:"Retain the evidence-backed licence correction if playback QA rolls publication back",
        original:{assetId:a.id, checksum:a.checksum, sourceUrl:a.metadata.sourceUrl},
        evidence:{run:42188424728, artifact:13489052274, frame:"credit-028.jpg"}, before, after})]);
    console.log("COSMOS_LICENCE_CORRECTED", JSON.stringify({from:before.licence_code,to:after.licence_code,evidence:after.evidence_url}));
  }
  await db.query("commit");
} catch (error) {
  await db.query("rollback").catch(()=>{});
  console.error("COSMOS_LICENCE_BLOCKED", error.message);
  process.exitCode=1;
} finally { db.release(); await pool.end(); }
