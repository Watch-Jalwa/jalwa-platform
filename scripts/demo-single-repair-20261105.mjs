// Jalwa existing internal-demo media repair: 11 previously portrait-padded short MP4s.
// Owner authorized internal-demo technical re-encoding. Rights/license entries remain unchanged.
// Source files remain untouched. Every result is a *new* immutable processed R2 key.
// Per-item playback pointer switches are transactional with audited rollback evidence.
// Use DEMO_BATCH_MODE=apply or DEMO_BATCH_MODE=rollback in the deployed worker container.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { createPool } from "/app/packages/postgres/index.mjs";
import { downloadObject, verifyObject, uploadDirectory } from "/app/apps/worker/src/storage.mjs";
import { buildShortArgs, run } from "/app/apps/worker/src/media.mjs";

const BATCH="jalwa-demo-aspect-v2-20261105-ec0a76f8";
const MODE=process.env.DEMO_BATCH_MODE;
const TARGET=process.env.DEMO_REPAIR_SLUG?.trim();
const DEMO_SHA="ec0a76f8efd3d9cf0a64e864d264be6d274deb34";
const slugs=[
 "mossy-tree-cc0", "ocean-surface-waves-cc0","tiny-waterfall-cc0",
 "tree-trimmer-cc0", "counting-chisenbop-cc0","vanellus-vanellus-cc0",
 "how-fossils-form-cc-by","eso-cast-254-light","eso-cast-265-light",
 "proxima-centauri-flythrough-cc-by","invitation-to-pakistan-nara"
];
const LICENSES=new Set(["CC0-1.0","CC-BY-4.0","US-gov-work"]);
assert.ok(slugs.includes(TARGET),"Refuse unknown demo video target");
console.log("SINGLE_REPAIR_START "+JSON.stringify({slug:TARGET,mode:MODE,release:process.env.GIT_SHA}));
assert.ok(MODE==="apply"||MODE==="rollback","Unsupported media batch mode");
assert.equal(process.env.DEPLOYMENT_ENVIRONMENT,"staging");
assert.equal(process.env.PAYMENT_PROVIDER,"mock");
assert.equal(process.env.MEDIA_BACKEND,"r2");
assert.equal(process.env.GIT_SHA,DEMO_SHA,"Unexpected deployed worker release");
assert.ok(buildShortArgs("/tmp/in","/tmp/out").join(" ").includes("force_original_aspect_ratio=decrease"));
assert.ok(!buildShortArgs("/tmp/in","/tmp/out").join(" ").includes("pad="));
const pool=createPool(process.env.DATABASE_URL,{max:2,application_name:"jalwa_demo_aspect_batch"});
const oneSql=[
  "select c.id as content_id,c.status::text content_status,c.hosting_mode::text hosting_mode,",
  "p.id as playback_id,p.media_asset_id,p.media_url,p.format::text format,",
  "a.storage_key,a.kind::text asset_kind,a.status::text asset_status,",
  "r.status::text rights_status,r.licence_code,r.self_hosting_confirmed,r.commercial_use_confirmed,r.rights_hold",
  "from public.content_items c",
  "join public.playback_sources p on p.content_id=c.id and p.is_primary=true",
  "join public.media_assets a on a.id=p.media_asset_id",
  "join public.rights_records r on r.content_id=c.id and r.status='approved'",
  "where c.slug=$1 order by r.verified_at desc nulls last limit 1"
].join(" ");
function ffprobe(file){
  const raw=execFileSync("ffprobe",["-v","error","-show_entries",
    "stream=codec_type,width,height,sample_aspect_ratio:format=duration","-of","json",file],
    {encoding:"utf8",timeout:60000});
  const data=JSON.parse(raw);
  const v=data.streams?.find(s=>s.codec_type==="video");
  if(!v?.width||!v?.height)throw Error("Missing video geometry");
  return {width:v.width,height:v.height,sar:v.sample_aspect_ratio||"1:1",
    audio:Boolean(data.streams?.some(s=>s.codec_type==="audio")),duration:Number(data.format?.duration||0)};
}
async function selectOne(slug){
  const r=await pool.query(oneSql,[slug]);
  assert.equal(r.rows.length,1,"Expected one primary approved video for "+slug);
  return r.rows[0];
}
async function recordSwitch(row,oldKey,newKey,details){
  const db=await pool.connect();
  try {
    await db.query("begin");
    await db.query("select pg_advisory_xact_lock(hashtext($1))",["jalwa-demo-aspect-"+row.slug]);
    const fresh=await db.query(
      "select media_url from public.playback_sources where id=$1 and is_primary=true for update",
      [row.playback_id]);
    assert.equal(fresh.rows.length,1);
    assert.equal(fresh.rows[0].media_url,oldKey,"Media pointer changed unexpectedly");
    const u=await db.query(
      "update public.playback_sources set media_url=$1 where id=$2 and media_url=$3 returning id",
      [newKey,row.playback_id,oldKey]);
    assert.equal(u.rowCount,1);
    const metadata={
      batchId:BATCH,slug:row.slug,demoOnly:true,oldMediaKey:oldKey,newMediaKey:newKey,
      licenceCode:row.licence_code,rightsAttestation:"owner-internal-demo-2026-11-05",
      workerRelease:DEMO_SHA,...details
    };
    await db.query(
      "insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(null,$1,'content_item',$2,$3::jsonb)",
      ["demo_media_aspect_batch_activated",row.content_id,JSON.stringify(metadata)]);
    await db.query("commit");
  }catch(e){await db.query("rollback").catch(()=>{});throw e}
  finally{db.release();}
}
async function restoreAll(){
  const log=await pool.query(
    "select entity_id,metadata from public.audit_logs where action=$1 and metadata->>'batchId'=$2 order by created_at desc",
    ["demo_media_aspect_batch_activated",BATCH]);
  const seen=new Set();
  let restored=0,already=0;
  for(const entry of log.rows){
    const data=entry.metadata;
    const slug=data.slug;
    if(slug!==TARGET||seen.has(slug))continue;
    seen.add(slug);
    assert.ok(data.oldMediaKey && data.newMediaKey);
    await verifyObject("processed",data.oldMediaKey);
    const db=await pool.connect();
    try{
      await db.query("begin");
      await db.query("select pg_advisory_xact_lock(hashtext($1))",["jalwa-demo-aspect-"+slug]);
      const q=await db.query(
        "select id,media_url from public.playback_sources where content_id=$1 and is_primary=true for update",
        [entry.entity_id]);
      assert.equal(q.rows.length,1);
      if(q.rows[0].media_url===data.oldMediaKey){already++;}
      else{
        assert.equal(q.rows[0].media_url,data.newMediaKey,"Unexpected pointer: refuse rollback "+slug);
        const res=await db.query(
          "update public.playback_sources set media_url=$1 where id=$2 and media_url=$3 returning id",
          [data.oldMediaKey,q.rows[0].id,data.newMediaKey]);
        assert.equal(res.rowCount,1);
        await db.query(
          "insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values(null,$1,'content_item',$2,$3::jsonb)",
          ["demo_media_aspect_batch_rolled_back",entry.entity_id,JSON.stringify({
            batchId:BATCH,slug,restoredMediaKey:data.oldMediaKey,candidateMediaKey:data.newMediaKey,
            candidatePreserved:true,reason:"batch validation or browser QA failed",demoOnly:true})]);
        restored++;
      }
      await db.query("commit");
    }catch(e){await db.query("rollback").catch(()=>{});throw e}
    finally{db.release();}
    console.log("BATCH_ROLLBACK "+JSON.stringify({slug,restored:restored+already}));
  }
  console.log("BATCH_ROLLBACK_SUMMARY "+JSON.stringify({batchId:BATCH,restored,already,expectedMax:1}));
}
async function applyOne(slug){
  const row=await selectOne(slug);
  assert.equal(row.content_status,"published");
  assert.equal(row.hosting_mode,"self_host_open");
  assert.equal(row.format,"mp4");
  assert.equal(row.asset_kind,"source_video");
  assert.equal(row.asset_status,"ready");
  assert.equal(row.rights_status,"approved");
  assert.equal(row.self_hosting_confirmed,true);
  assert.equal(row.commercial_use_confirmed,true);
  assert.equal(row.rights_hold,false);
  assert.ok(LICENSES.has(row.licence_code),"Unexpected licence: "+slug);
  const old="processed/"+row.content_id+"/"+row.media_asset_id+"/short-720.mp4";
  if(row.media_url!==old){
    // Already moved by this batch? Verify from a matching auditable entry rather than claiming success.
    const previous=await pool.query(
      "select metadata from public.audit_logs where action=$1 and entity_id=$2 and metadata->>'batchId'=$3 order by created_at desc limit 1",
      ["demo_media_aspect_batch_activated",row.content_id,BATCH]);
    if(previous.rows.length && previous.rows[0].metadata.newMediaKey===row.media_url){
      console.log("BATCH_ALREADY_ACTIVE "+JSON.stringify({slug}));
      return "already";
    }
    throw Error("Unrecognized playback path for "+slug);
  }
  const headSource=await verifyObject("incoming",row.storage_key);
  const oldHead=await verifyObject("processed",old);
  assert.ok(headSource.sizeBytes>1000&&headSource.sizeBytes<250_000_000);
  assert.ok(oldHead.sizeBytes>1000);
  const root=await mkdtemp(join(tmpdir(),"jalwa-demo-batch-"));
  try{
    const source=join(root,"source"),out=join(root,"output"),targetFile=join(out,"short-720.mp4");
    await mkdir(out,{recursive:true});
    console.log("SINGLE_DOWNLOAD_SOURCE "+JSON.stringify({slug,sizeBytes:headSource.sizeBytes}));
    await downloadObject(row.storage_key,source,"incoming");
    assert.equal((await stat(source)).size,headSource.sizeBytes);
    const input=ffprobe(source);
    console.log("SINGLE_TRANSCODE_START "+slug);
    const encodeArgs=buildShortArgs(source,targetFile);
    encodeArgs.splice(1,0,"-filter_threads","1");
    encodeArgs.splice(-1,0,"-threads","1");
    await run("ffmpeg",encodeArgs,12*60*1000);
    console.log("SINGLE_TRANSCODE_DONE "+slug);
    const output=ffprobe(targetFile);
    const outputBytes=(await stat(targetFile)).size;
    assert.ok(outputBytes>1000);
    assert.ok(Math.abs(input.width/input.height-output.width/output.height)<0.025,
      "New output violates natural source aspect for "+slug);
    assert.ok(output.width<=input.width+2 && output.height<=input.height+2);
    assert.ok(Math.max(output.width,output.height)<=1280);
    assert.ok(Math.abs(input.duration-output.duration)<1.5);
    assert.ok(!input.audio||output.audio);
    const sourceHash=createHash("sha256").update(await readFile(source)).digest("hex");
    const newKey="processed/"+row.content_id+"/"+row.media_asset_id+"/aspect-v2-"+sourceHash.slice(0,16)+"-demo-20261105/short-720.mp4";
    let existing;
    try{existing=await verifyObject("processed",newKey);}catch(e){
      const status=Number(e?.$metadata?.httpStatusCode||0);
      if(status!==404 && e?.name!=="NotFound" && e?.name!=="NoSuchKey")throw e;
      existing=null;
    }
    if(!existing){
      const prefix=newKey.slice(0,newKey.lastIndexOf("/")+1);
      const uploaded=await uploadDirectory(out,prefix);
      assert.deepEqual(uploaded,[newKey]);
    }
    const newHead=await verifyObject("processed",newKey);
    assert.equal(newHead.sizeBytes,outputBytes,"Candidate R2 object differs");
    await recordSwitch({...row,slug},old,newKey,{
      input,output,sourceSha256:sourceHash,oldBytes:oldHead.sizeBytes,newBytes:newHead.sizeBytes
    });
    console.log("BATCH_ACTIVATED "+JSON.stringify({slug,licence:row.licence_code,input,output,
      oldBytes:oldHead.sizeBytes,newBytes:newHead.sizeBytes,oldPreserved:true,
      rightsUnchanged:true,newPathVersioned:true}));
    return "activated";
  } finally {await rm(root,{recursive:true,force:true});}
}
try{
  if(MODE==="rollback"){await restoreAll();}
  else {
    let activated=0,already=0;
    try{
      for(const slug of [TARGET]){
        const result=await applyOne(slug);
        if(result==="activated")activated++;else already++;
      }
      console.log("BATCH_SUCCESS "+JSON.stringify({batchId:BATCH,activated,already,total:1}));
    }catch(e){
      console.error("BATCH_ERROR "+String(e?.message||e).slice(0,300));
      await restoreAll();
      throw e;
    }
  }
} finally {await pool.end();}
