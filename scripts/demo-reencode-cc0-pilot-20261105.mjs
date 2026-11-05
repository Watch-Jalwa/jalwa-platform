// Jalwa owner-authorized internal-demo re-encode pilot.
// Creates a NEW, versioned processed R2 object. Does not mutate any DB rows,
// object currently referenced by playback, rights flags, or production settings.
// Designed for docker exec -i jalwa-worker-staging node --input-type=module -.
import assert from "node:assert/strict";
import { randomUUID, createHash } from "node:crypto";
import { mkdtemp, mkdir, rm, stat, readFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { execFileSync } from "node:child_process";
import { createPool } from "/app/packages/postgres/index.mjs";
import { downloadObject, verifyObject, uploadDirectory } from "/app/apps/worker/src/storage.mjs";
import { buildShortArgs, run } from "/app/apps/worker/src/media.mjs";

const slug = "baking-cookies-cc0";
const release = process.env.GIT_SHA || "";
assert.match(release,/^[0-9a-f]{40}$/, "Require immutable deployed demo image SHA");
assert.equal(process.env.DEPLOYMENT_ENVIRONMENT, "staging", "Refuse non-demo runtime");
assert.equal(process.env.MEDIA_BACKEND, "r2", "Only current R2 demo backend supported");
assert.equal(process.env.PAYMENT_PROVIDER, "mock", "Demo must remain mock-payment");
const demoArg = buildShortArgs("/tmp/input","/tmp/output").join(" ");
assert.ok(demoArg.includes("force_original_aspect_ratio=decrease") && !demoArg.includes("pad="),
  "Worker is not running the patched orientation-preserving short encoder");

const pool=createPool(process.env.DATABASE_URL,{max:2,application_name:"jalwa_demo_immutable_pilot"});
const client=await pool.connect();
let row;
try {
  await client.query("begin transaction read only");
  const sql=[
    "select c.id as content_id,c.slug,c.status::text content_status,c.hosting_mode::text hosting_mode,",
    "p.id as playback_id,p.media_asset_id,p.media_url,p.format::text format,",
    "a.storage_key,a.kind::text asset_kind,a.status::text asset_status,",
    "r.status::text rights_status,r.licence_code,r.self_hosting_confirmed,r.commercial_use_confirmed,r.rights_hold",
    "from public.content_items c",
    "join public.playback_sources p on p.content_id=c.id and p.is_primary=true",
    "join public.media_assets a on a.id=p.media_asset_id",
    "join public.rights_records r on r.content_id=c.id and r.status='approved'",
    "where c.slug=$1 order by r.verified_at desc nulls last limit 1"
  ].join(" ");
  const result=await client.query(sql,[slug]);row=result.rows[0];
  await client.query("rollback");
}finally{client.release();await pool.end();}
assert.ok(row,"Source/playback/rights row absent");
assert.equal(row.content_status,"published");
assert.equal(row.hosting_mode,"self_host_open");
assert.equal(row.asset_kind,"source_video");
assert.equal(row.asset_status,"ready");
assert.equal(row.format,"mp4");
assert.equal(row.rights_status,"approved");
assert.equal(row.licence_code,"CC0-1.0","Pilot only approved CC0 public-domain originals");
assert.equal(row.self_hosting_confirmed,true);
assert.equal(row.commercial_use_confirmed,true);
assert.equal(row.rights_hold,false);
assert.ok(row.storage_key && row.media_url && row.media_asset_id);
assert.equal(row.media_url,"processed/"+row.content_id+"/"+row.media_asset_id+"/short-720.mp4",
  "Do not target a playback row with unexpected original media path");
const sourceHead=await verifyObject("incoming",row.storage_key);
const existingHead=await verifyObject("processed",row.media_url);
assert.ok(sourceHead.sizeBytes>1000 && sourceHead.sizeBytes<40_000_000,
  "Unexpected pilot source size");
assert.ok(existingHead.sizeBytes>1000, "Previous processed video missing; no rollback reference");
const dir=await mkdtemp(join(tmpdir(),"jalwa-demo-pilot-"));
const source=join(dir,"original");
const outputDir=join(dir,"output");
const output=join(outputDir,"short-720.mp4");
function ffprobe(file) {
  const raw=execFileSync("ffprobe",["-v","error","-show_entries",
    "stream=codec_type,width,height,sample_aspect_ratio:format=duration",
    "-of","json",file],{encoding:"utf8",timeout:60000});
  const d=JSON.parse(raw),v=d.streams?.find(s=>s.codec_type==="video");
  if(!v?.width || !v?.height)throw Error("No decoded video dimensions");
  return {width:v.width,height:v.height,sar:v.sample_aspect_ratio||"1:1",
    audio:Boolean(d.streams?.some(s=>s.codec_type==="audio")),
    duration:Number(d.format?.duration||0)};
}
try{
  await mkdir(outputDir,{recursive:true});
  await downloadObject(row.storage_key,source,"incoming");
  const incomingBytes=(await stat(source)).size;
  assert.equal(incomingBytes,sourceHead.sizeBytes,"Downloaded source must match R2 HEAD length");
  const original=ffprobe(source);
  await run("ffmpeg",buildShortArgs(source,output),15*60*1000);
  const generated=ffprobe(output);
  const generatedBytes=(await stat(output)).size;
  const originalAspect=original.width/original.height;
  const generatedAspect=generated.width/generated.height;
  assert.ok(Math.abs(originalAspect-generatedAspect)<0.025,
    "Output changes natural video aspect");
  assert.ok(Math.max(generated.width,generated.height)<=1280,
    "Output exceeds configured long edge");
  assert.ok(generated.width<=original.width+2 && generated.height<=original.height+2,
    "Unexpected video upscaling");
  assert.ok(generatedBytes>1000,"Output too small");
  assert.ok(Math.abs(generated.duration-original.duration)<1.5,
    "Duration unexpectedly changed");
  assert.ok(!original.audio || generated.audio,"Source audio lost");
  const originalHash=createHash("sha256").update(await readFile(source)).digest("hex");
  const revision="aspect-v2-"+originalHash.slice(0,12)+"-"+randomUUID().slice(0,8);
  const prefix="processed/"+row.content_id+"/"+row.media_asset_id+"/"+revision+"/";
  const targetKey=prefix+"short-720.mp4";
  const uploaded=await uploadDirectory(outputDir,prefix);
  assert.deepEqual(uploaded,[targetKey],"Only one versioned MP4 should be uploaded");
  const target=await verifyObject("processed",targetKey);
  assert.equal(target.sizeBytes,generatedBytes);
  console.log("DEMO_ENCODE_PILOT "+JSON.stringify({
    slug,release,approvedLicence:row.licence_code,
    sourceSha256:originalHash,oldMediaKey:row.media_url,newMediaKey:targetKey,
    input:original,output:generated,oldBytes:existingHead.sizeBytes,newBytes:target.sizeBytes,
    demoOnly:true,dbChanged:false,oldR2ObjectChanged:false,
  }));
}finally{await rm(dir,{recursive:true,force:true});}
