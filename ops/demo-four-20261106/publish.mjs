import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createPool } from "/app/packages/postgres/index.mjs";
import { downloadObject, verifyObject } from "/app/apps/worker/src/storage.mjs";

const env = process.env;
const slug = env.JALWA_FOUR_SLUG, mode = env.JALWA_FOUR_MODE, run = env.JALWA_FOUR_RUN;
assert(["spring-blender","sprite-fright","caminandes-llamigos","apollo-11-eagle-has-landed","cosmos-laundromat"].includes(slug));
assert(["inspect","publish","rollback"].includes(mode));
assert.match(run, /^[1-9]\d*-[1-9]\d*$/);
assert.equal(env.DEPLOYMENT_ENVIRONMENT, "staging");
assert.equal(env.MEDIA_BACKEND, "r2");
assert.equal(env.PAYMENT_PROVIDER, "mock");
assert.match(env.JALWA_FOUR_EXPECTED_SHA, /^[a-f0-9]{40}$/);
assert.equal(env.GIT_SHA, env.JALWA_FOUR_EXPECTED_SHA);

const pool = createPool(env.DATABASE_URL, {max:1, application_name:"jalwa_demo_four_review"});
const db = await pool.connect();
async function one(query, args) {
  const result = await db.query(query, args);
  assert.equal(result.rowCount, 1, "Expected one matching record");
  return result.rows[0];
}
const editorialKeys = ["title_en","title_ur","title_roman_ur","description_en","description_ur","description_roman_ur","language","audience","duration_seconds"];
async function loadCandidate() {
  const c = await one(`select c.*,public.has_publishable_rights(c.id,c.hosting_mode,c.access_level) publishable,
    public.is_content_processing_allowed(c.id) processing_ok from public.content_items c where slug=$1 for update`,[slug]);
  assert.equal(c.hosting_mode, "self_host_open");
  assert.equal(c.access_level, "public");
  assert.equal(c.content_type, "video");
  assert(c.publishable && c.processing_ok && !c.disabled_at && !c.disabled_reason, "Catalogue rights or operational hold");
  assert(!c.publish_at || c.publish_at <= new Date(), "Scheduled for a future date");
  assert(!c.unpublish_at || c.unpublish_at > new Date(), "Publication window closed");
  const r = await one(`select r.* from public.rights_records r where content_id=$1
    and status='approved' and not rights_hold and self_hosting_confirmed and commercial_use_confirmed
    and verified_by is not null and verified_at is not null and (expires_at is null or expires_at>now()) for share`,[c.id]);
  const approval = await one(`select exists(select 1 from public.audit_logs where entity_id=$1::text
    and action='rights_approved' and actor_id is not null) ok`,[c.id]);
  assert(approval.ok, "Missing item-level approval audit");
  const p = await one(`select * from public.playback_sources where content_id=$1 and is_primary for update`,[c.id]);
  const a = await one(`select * from public.media_assets where content_id=$1 and id=$2 and kind='source_video' for update`,[c.id,p.media_asset_id]);
  const j = await one(`select status,cancel_requested from public.media_jobs where media_asset_id=$1 order by created_at desc limit 1 for share`,[a.id]);
  assert.equal(j.status,"completed");
  assert(!j.cancel_requested && !a.disabled_at && !a.disabled_reason && !p.disabled_at && !p.disabled_reason,"Disabled media");
  assert.equal(a.status,"ready");
  assert.equal(p.status,"active");
  assert.equal(p.format,"hls");
  assert.equal(p.media_url,`processed/${c.id}/${a.id}/master.m3u8`);
  assert(a.storage_key.startsWith(`incoming/${c.id}/${a.id}/`));
  return {c,r,p,a};
}

async function decodeMedia({a,p}) {
  const source = await verifyObject("incoming",a.storage_key);
  assert.equal(source.sizeBytes, Number(a.size_bytes));
  assert(source.sizeBytes > 0);
  const work = await mkdtemp(join(tmpdir(),"jalwa-four-"));
  try {
    const readPlaylist = async (key) => {
      const local = join(work,"playlist");
      await downloadObject(key,local,"processed");
      const raw = await readFile(local,"utf8");
      assert(raw.startsWith("#EXTM3U"), "Invalid HLS playlist");
      return raw;
    };
    const master = await readPlaylist(p.media_url);
    const entries = raw => raw.split(/\r?\n/).map(x=>x.trim()).filter(x=>x && !x.startsWith("#"));
    const variants = entries(master);
    assert.deepEqual(variants.toSorted(), ["360p/index.m3u8","480p/index.m3u8","720p/index.m3u8"]);
    const dir = p.media_url.slice(0,-"master.m3u8".length);
    for (const variant of variants) {
      const index = await readPlaylist(dir+variant);
      assert(index.includes("#EXT-X-ENDLIST"), "Incomplete HLS playlist");
      const segments = entries(index);
      assert(segments.length && segments.every(x=>/^segment-\d{5}\.ts$/.test(x)), "Missing HLS segments");
      const segment = join(work,"sample.ts");
      await downloadObject(dir+variant.split("/")[0]+"/"+segments[0],segment,"processed");
      execFileSync("ffmpeg",["-nostdin","-v","error","-xerror","-i",segment,"-map","0:v:0","-frames:v","1","-f","null","-"], {timeout:30000,stdio:["ignore","ignore","pipe"]});
    }
    console.log("MEDIA_VERIFIED", JSON.stringify({slug,variants:variants.length,assetId:a.id}));
  } finally { await rm(work,{recursive:true,force:true}); }
}

function editorial(c,r) {
  const reviews = JSON.parse(env.JALWA_FOUR_REVIEWS || "{}");
  const review = reviews[slug];
  assert.equal(review?.decision,"clear",review?.reason || "No title-specific editorial decision");
  assert.equal(r.source_url,review.sourcePage);
  assert.equal(r.licence_code,review.licenceCode);
  assert.match(review.editorialEvidence,/^https:\/\//);
  assert.deepEqual(Object.keys(review.before).sort(),Object.keys(review.after).sort());
  const before = {}, after = {};
  for (const key of Object.keys(review.before)) {
    assert(editorialKeys.includes(key),"Unsupported editorial field");
    if(c[key] === review.after[key]) continue;
    assert.equal(c[key],review.before[key],"Editorial record changed: "+key);
    before[key] = c[key];
    after[key] = review.after[key];
  }
  return {review,before,after};
}

async function audit(action,id,metadata) {
  await db.query(`insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(null,$1,'content_item',$2,$3::jsonb)`,[action,id,JSON.stringify({slug,run,scope:"shared-demo-only",release:env.GIT_SHA,...metadata})]);
}
async function setContent(id,fields,activation) {
  const keys = Object.keys(fields);
  assert(keys.every(k=>editorialKeys.includes(k)));
  const values = Object.values(fields);
  const terms = keys.map((k,i)=>k+"=$"+(i+2));
  const tail = activation ? "status='published',is_available=true,publish_at=coalesce(publish_at,now())"
    : "status='editorial_review',is_available=false,publish_at=$"+(keys.length+2);
  if (!activation) values.push(previousPublishAt);
  return one("update public.content_items set "+[...terms,tail].join(",")+" where id=$1 returning xmin::text revision",[id,...values]);
}
let previousPublishAt = null;
try {
  await db.query("begin");
  await db.query("set local lock_timeout='8s'");
  await db.query("select pg_advisory_xact_lock(hashtext($1))",["jalwa-demo14-"+slug]);
  if(mode === "rollback") {
    const c = await one("select id,status,xmin::text revision from public.content_items where slug=$1 for update",[slug]);
    const own = await db.query(`select metadata from public.audit_logs where entity_id=$1::text and action='demo_four_published'
      and metadata->>'run'=$2 order by created_at desc limit 1`,[c.id,run]);
    if(own.rowCount && c.status==="published"){
      const m = own.rows[0].metadata;
      assert.equal(c.revision,m.revision,"Content changed after this run");
      await one("update public.media_assets set is_available=false where id=$1 and is_available and xmin::text=$2 returning id",[m.assetId,m.assetRevision]);
      await one("update public.playback_sources set is_available=false where id=$1 and is_available and xmin::text=$2 returning id",[m.playbackId,m.playbackRevision]);
      previousPublishAt=m.publishAt;
      await setContent(c.id,m.before,false);
      await audit("demo_four_qa_rollback",c.id,{assetId:m.assetId,originalPreserved:true});
      console.log("ROLLED_BACK",slug);
    } else console.log("NO_OWN_PUBLICATION", slug);
  } else {
    const data = await loadCandidate(), {c,r,p,a} = data;
    console.log("CANDIDATE",JSON.stringify({slug,status:c.status,title:c.title_en,licence:r.licence_code,media:p.format}));
    if (mode === "publish") {
      const {review,before,after}=editorial(c,r);
      assert.equal(a.metadata?.sourcePage,review.originalSourcePage || review.sourcePage,"Original source provenance mismatch");
      await decodeMedia(data);
      if(c.status==="published"){
        assert(c.is_available && a.is_available && p.is_available);
        assert.equal(Object.keys(after).length,0,"Existing published item requires editorial review");
        console.log("ALREADY_PUBLISHED",slug);
      } else {
        assert.equal(c.status,"editorial_review");
        assert(!c.is_available && !a.is_available && !p.is_available, "Unexpected pre-publication availability");
        const ar=await one("update public.media_assets set is_available=true where id=$1 returning xmin::text revision",[a.id]);
        const pr=await one("update public.playback_sources set is_available=true where id=$1 returning xmin::text revision",[p.id]);
        const cr=await setContent(c.id,after,true);
        const effective=await one("select public.is_content_effectively_available($1) ok",[c.id]);
        assert(effective.ok,"Published row did not pass effective availability");
        await audit("demo_four_published",c.id,{assetId:a.id,playbackId:p.id,rightsId:r.id,editorialEvidence:review.editorialEvidence,before,after,publishAt:c.publish_at,revision:cr.revision,assetRevision:ar.revision,playbackRevision:pr.revision});
        console.log("PUBLISHED",slug);
      }
    }
  }
  await db.query("commit");
} catch(error) {
  await db.query("rollback").catch(()=>{});
  console.error("FOUR_TITLE_BLOCKED",slug,error?.message);
  process.exitCode=1;
} finally { db.release(); await pool.end(); }
