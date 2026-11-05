// Internal-demo only: recover three licensed audio originals already stored in R2.
// Fail closed on release/env/rights changes; no YouTube access, no source overwrite.
// Modes: queue, ready, publish, rollback. Each invocation targets ONE allowlisted title.
import assert from "node:assert/strict";
import { createPool } from "/app/packages/postgres/index.mjs";
import { verifyObject } from "/app/apps/worker/src/storage.mjs";
const TITLE=new Set([
  "huamei-bird-calling-cc0",
  "house-sparrow-tschilp-cc0",
  "abrasive-bird-debate-cc0"
]);
const slug=process.env.AUDIO_REPAIR_SLUG;
const mode=process.env.AUDIO_REPAIR_MODE;
const expected=process.env.AUDIO_EXPECTED_SHA;
assert.ok(TITLE.has(slug),"Invalid audio demo target");
assert.ok(["queue","ready","publish","rollback"].includes(mode),"Invalid audio repair mode");
assert.match(expected||"",/^[a-f0-9]{40}$/);
assert.equal(process.env.DEPLOYMENT_ENVIRONMENT,"staging");
assert.equal(process.env.PAYMENT_PROVIDER,"mock");
assert.equal(process.env.MEDIA_BACKEND,"r2");
assert.equal(process.env.GIT_SHA,expected,"Deployed worker release changed");
const pool=createPool(process.env.DATABASE_URL,{max:2,application_name:"jalwa_demo_audio_repair"});

async function locate(db){
 const r=await db.query([
  "select c.id content_id,c.slug,c.status::text content_status,c.content_type::text content_type,",
  "c.hosting_mode::text hosting_mode,c.access_level::text access_level,c.is_available content_available,",
  "public.has_publishable_rights(c.id,c.hosting_mode,c.access_level) rights_gate,",
  "exists(select 1 from public.rights_records rr where rr.content_id=c.id and rr.status='approved'",
  "and rr.rights_hold=false and rr.self_hosting_confirmed=true and rr.commercial_use_confirmed=true) approved,",
  "(select count(*)::integer from public.media_jobs mj",
  "join public.media_assets ma on ma.id=mj.media_asset_id",
  "where ma.content_id=c.id and mj.status in ('queued','processing')) active_jobs",
  "from public.content_items c where c.slug=$1"
 ].join(" "),[slug]);
 assert.equal(r.rows.length,1,"Expected exactly one demo audio content row");
 const c=r.rows[0];
 assert.equal(c.content_type,"audio");
 assert.equal(c.hosting_mode,"self_host_open");
 assert.equal(c.access_level,"public");
 const a=await db.query([
  "select a.id asset_id,a.storage_key,a.mime_type,a.size_bytes,",
  "a.status::text asset_status,a.is_available asset_available,",
  "j.id job_id,j.status::text job_status,j.attempts,j.max_attempts,",
  "j.locked_at,j.locked_by",
  "from public.media_assets a",
  "join public.media_jobs j on j.media_asset_id=a.id",
  "where a.content_id=$1 and a.kind='source_video'",
  "order by a.created_at desc,j.created_at desc limit 1"
 ].join(" "),[c.content_id]);
 assert.equal(a.rows.length,1,"Expected one source asset+media job");
 const v=a.rows[0];
 assert.equal(v.mime_type,"audio/ogg");
 assert.ok(v.size_bytes>1000&&v.size_bytes<10_000_000);
 assert.ok(v.storage_key.startsWith("incoming/"));
 assert.equal(v.max_attempts,3);
 return {...c,...v};
}
function permitted(record){
 assert.equal(record.approved,true,"Rights record is not approved");
 assert.equal(record.rights_gate,true,"Publication rights gate not satisfied");
 assert.ok(["editorial_review","published"].includes(record.content_status));
}
async function audit(db,action,record,details={}){
 await db.query("insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values (null,$1,'content_item',$2,$3::jsonb)",[
  action,record.content_id,JSON.stringify({slug,scope:"existing_demo",workerSha:expected,...details})
 ]);
}
async function queue(){
 let r=await locate(pool);
 permitted(r);
 if(r.asset_status==="ready"&&r.job_status==="completed"){
   console.log("AUDIO_ALREADY_READY "+JSON.stringify({slug,assetId:r.asset_id}));return;
 }
 if(["queued","processing"].includes(r.job_status)) {
   console.log("AUDIO_ALREADY_QUEUED "+JSON.stringify({slug,status:r.job_status}));return;
 }
 assert.equal(r.active_jobs,0,"Another media job is active for this audio title");
 assert.equal(r.job_status,"failed");
 assert.equal(r.asset_status,"failed");
 assert.equal(r.attempts,3);
 assert.equal(r.content_available,false);
 const h=await verifyObject("incoming",r.storage_key);
 assert.equal(h.sizeBytes,Number(r.size_bytes));
 const db=await pool.connect();
 try{
  await db.query("begin");
  await db.query("select pg_advisory_xact_lock(hashtext($1))",["jalwa-audio-"+slug]);
  const curr=await locate(db);
  assert.equal(curr.job_id,r.job_id);
  assert.equal(curr.job_status,"failed");
  assert.equal(curr.asset_status,"failed");
  assert.equal(curr.active_jobs,0);
  const u=await db.query([
   "update public.media_jobs set status='queued',attempts=0,",
   "locked_at=null,locked_by=null,completed_at=null,error_message=null,",
   "cancel_requested=false,cancellation_reason=null,available_at=now(),updated_at=now()",
   "where id=$1 and status='failed' and attempts=3 returning id"
  ].join(" "),[curr.job_id]);
  assert.equal(u.rowCount,1);
  const a=await db.query([
   "update public.media_assets set status='queued',is_available=false,",
   "disabled_at=null,disabled_reason=null,updated_at=now()",
   "where id=$1 and status='failed' returning id"
  ].join(" "),[curr.asset_id]);
  assert.equal(a.rowCount,1);
  await audit(db,"demo_audio_source_requeued",curr,{jobId:curr.job_id,sourceBytes:Number(curr.size_bytes),sourcePreserved:true});
  await db.query("commit");
  console.log("AUDIO_QUEUED "+JSON.stringify({slug,assetId:curr.asset_id,jobId:curr.job_id,sourcePreserved:true}));
 }catch(e){await db.query("rollback").catch(()=>{});throw e}
 finally{db.release()}
}
async function ready(){
 const r=await locate(pool);
 if(r.asset_status!=="ready"||r.job_status!=="completed") {
  console.log("AUDIO_NOT_READY "+JSON.stringify({slug,asset:r.asset_status,job:r.job_status}));
  process.exitCode=3;return;
 }
 const p=await pool.query([
  "select p.id,p.media_url,p.format::text format,p.status::text status,p.is_primary,",
  "p.media_asset_id",
  "from public.playback_sources p where p.content_id=$1 and p.media_asset_id=$2",
  "and p.is_primary=true order by p.id desc limit 1"
 ].join(" "),[r.content_id,r.asset_id]);
 assert.equal(p.rows.length,1);
 const b=p.rows[0];
 assert.equal(b.status,"active");
 assert.equal(b.format,"mp4");
 assert.equal(b.media_url,"processed/"+r.content_id+"/"+r.asset_id+"/audio.m4a");
 const obj=await verifyObject("processed",b.media_url);
 assert.ok(obj.sizeBytes>1000&&obj.contentType==="audio/mp4","Decoded audio object/MIME missing");
 console.log("AUDIO_READY "+JSON.stringify({slug,assetId:r.asset_id,bytes:obj.sizeBytes,codecContainer:"m4a",mime:obj.contentType}));
}
async function publish(){
 let r=await locate(pool);
 permitted(r);
 assert.equal(r.asset_status,"ready");
 assert.equal(r.job_status,"completed");
 const p=await pool.query("select id,media_url,format::text format,status::text status,is_primary,is_available from public.playback_sources where content_id=$1 and media_asset_id=$2 and is_primary=true",[r.content_id,r.asset_id]);
 assert.equal(p.rows.length,1);
 assert.equal(p.rows[0].media_url,"processed/"+r.content_id+"/"+r.asset_id+"/audio.m4a");
 assert.equal(p.rows[0].format,"mp4");
 assert.equal(p.rows[0].status,"active");
 const obj=await verifyObject("processed",p.rows[0].media_url);
 assert.equal(obj.contentType,"audio/mp4");
 assert.ok(obj.sizeBytes>1000);
 if(r.content_status==="published"&&r.content_available&&p.rows[0].is_available){
  console.log("AUDIO_ALREADY_PUBLISHED "+JSON.stringify({slug,bytes:obj.sizeBytes}));return;
 }
 assert.equal(r.content_status,"editorial_review");
 assert.equal(r.content_available,false);
 const db=await pool.connect();
 try{
  await db.query("begin");
  await db.query("select pg_advisory_xact_lock(hashtext($1))",["jalwa-audio-"+slug]);
  r=await locate(db);
  permitted(r);
  assert.equal(r.content_status,"editorial_review");
  assert.equal(r.asset_status,"ready");
  const a=await db.query("update public.media_assets set is_available=true,disabled_at=null,disabled_reason=null where id=$1 and status='ready' returning id",[r.asset_id]);assert.equal(a.rowCount,1);
  await db.query("update public.playback_sources set is_available=false where content_id=$1 and media_asset_id is distinct from $2",[r.content_id,r.asset_id]);
  const pb=await db.query("update public.playback_sources set is_primary=true,is_available=true,status='active',disabled_at=null,disabled_reason=null where content_id=$1 and media_asset_id=$2 and format='mp4' returning id",[r.content_id,r.asset_id]);assert.equal(pb.rowCount,1);
  const c=await db.query("update public.content_items set status='published',publish_at=coalesce(publish_at,now()),unpublish_at=null,is_available=true,disabled_at=null,disabled_reason=null,updated_at=now() where id=$1 and status='editorial_review' and public.has_publishable_rights(id,hosting_mode,access_level) returning id",[r.content_id]);assert.equal(c.rowCount,1);
  await audit(db,"demo_audio_verified_published",r,{assetId:r.asset_id,mediaPath:p.rows[0].media_url,rightsUnchanged:true});
  await db.query("commit");
  console.log("AUDIO_PUBLISHED "+JSON.stringify({slug,assetId:r.asset_id,bytes:obj.sizeBytes,rightsUnchanged:true}));
 }catch(e){await db.query("rollback").catch(()=>{});throw e}
 finally{db.release()}
}
async function rollback(){
 const db=await pool.connect();
 try{
  await db.query("begin");
  await db.query("select pg_advisory_xact_lock(hashtext($1))",["jalwa-audio-"+slug]);
  const r=await locate(db);
  if(r.content_status==="editorial_review"&&!r.content_available){await db.query("commit");console.log("AUDIO_ALREADY_UNPUBLISHED "+slug);return;}
  assert.equal(r.content_status,"published");
  const pb=await db.query("select id,media_url from public.playback_sources where content_id=$1 and media_asset_id=$2 and is_primary=true for update",[r.content_id,r.asset_id]);
  assert.equal(pb.rows.length,1);
  assert.equal(pb.rows[0].media_url,"processed/"+r.content_id+"/"+r.asset_id+"/audio.m4a");
  await db.query("update public.content_items set status='editorial_review',is_available=false,updated_at=now() where id=$1",[r.content_id]);
  await db.query("update public.playback_sources set is_available=false where id=$1",[pb.rows[0].id]);
  await db.query("update public.media_assets set is_available=false where id=$1",[r.asset_id]);
  await audit(db,"demo_audio_qa_rollback",r,{assetId:r.asset_id,processedMediaPreserved:true});
  await db.query("commit");
  console.log("AUDIO_UNPUBLISHED "+slug);
 }catch(e){await db.query("rollback").catch(()=>{});throw e}
 finally{db.release()}
}
try{
 if(mode==="queue")await queue();
 else if(mode==="ready")await ready();
 else if(mode==="publish")await publish();
 else await rollback();
}catch(e){console.error("AUDIO_REPAIR_FAILED "+String(e.message||e));process.exitCode=1}
finally{await pool.end()}
