import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtemp, rm } from "node:fs/promises";
import { createWriteStream } from "node:fs";
import { pipeline } from "node:stream/promises";
import { execFileSync } from "node:child_process";
import { createPool } from "/app/packages/postgres/index.mjs";
import { verifyObject } from "/app/apps/worker/src/storage.mjs";
const { S3Client, GetObjectCommand } = createRequire("/app/package.json")("@aws-sdk/client-s3");
assert.equal(process.env.DEPLOYMENT_ENVIRONMENT,"staging");
assert.equal(process.env.MEDIA_BACKEND,"r2");
assert.equal(process.env.PAYMENT_PROVIDER,"mock");
assert.equal(process.env.GIT_SHA,process.env.RELEASE_SHA);
const db=createPool(process.env.DATABASE_URL,{max:1});
const client=new S3Client({region:"auto",endpoint:process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials:{accessKeyId:process.env.R2_ACCESS_KEY_ID,secretAccessKey:process.env.R2_SECRET_ACCESS_KEY}});
const dir=await mkdtemp("/tmp/jalwa-retained-probe-");
try {
  const q=await db.query(`select c.id as content_id,c.slug,c.status as content_status,c.is_available,
    public.has_publishable_rights(c.id,c.hosting_mode,c.access_level) as rights_ok,
    public.is_content_processing_allowed(c.id) as processing_ok,
    a.id as asset_id,a.status as asset_status,a.storage_key,a.size_bytes,a.checksum,a.metadata,a.disabled_reason,
    j.id as job_id,j.job_type,j.status as job_status,j.attempts,j.max_attempts,j.locked_at,j.locked_by,j.cancel_requested,j.error_message
    from public.content_items c join public.media_assets a on a.content_id=c.id and a.kind='source_video'
    join lateral(select * from public.media_jobs j where j.media_asset_id=a.id order by created_at desc limit 1) j on true
    where c.slug=any($1::text[]) and a.disabled_reason='stale_worker_lock_reconciled_20261105' order by c.slug`,
    [["sintel","vhs-static-cc0-clip"]]);
  assert.equal(q.rowCount,2);
  for(const r of q.rows) {
    assert(r.rights_ok && r.processing_ok && !r.is_available && !r.cancel_requested);
    assert.equal(r.asset_status,"failed");assert.equal(r.job_status,"failed");
    assert(!r.locked_at && !r.locked_by && r.attempts<r.max_attempts);
    assert(r.storage_key.startsWith(`incoming/${r.content_id}/${r.asset_id}/`));
    const object=await verifyObject("incoming",r.storage_key);
    assert.equal(object.sizeBytes,Number(r.size_bytes));
    assert.match(r.checksum,/^[a-f0-9]{64}$/);
    const part=await client.send(new GetObjectCommand({Bucket:process.env.R2_INCOMING_BUCKET || process.env.R2_BUCKET,Key:r.storage_key,Range:"bytes=0-16777215"}),{abortSignal:AbortSignal.timeout(90000)});
    assert.equal(part.$metadata.httpStatusCode,206);
    const file=dir+"/"+r.slug;
    await pipeline(part.Body,createWriteStream(file));
    const probe=JSON.parse(execFileSync("ffprobe",["-v","quiet","-show_entries","stream=index,codec_type,codec_name,width,height:stream_tags=language,title:format=duration","-of","json",file],{timeout:30000,encoding:"utf8",maxBuffer:1000000}));
    const {storage_key,metadata,...safe}=r;
    console.log("RETAINED_PREFLIGHT "+JSON.stringify({...safe,source:{original_filename:metadata.original_filename,source:metadata.source,wave:metadata.wave,pipeline:metadata.pipeline},headerProbe:probe}));
  }
} finally {await rm(dir,{recursive:true,force:true});client.destroy();await db.end();}
