import assert from "node:assert/strict";
import { createReadStream } from "node:fs";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { execFileSync } from "node:child_process";
import { createPool } from "/app/packages/postgres/index.mjs";
import { downloadObject, verifyObject, uploadDirectory } from "/app/apps/worker/src/storage.mjs";
import { buildShortArgs, buildHlsArgs, buildThumbnailArgs, run } from "/app/apps/worker/src/media.mjs";

const env = process.env;
const mode = env.JALWA_REPAIR_MODE || "inspect";
const slug = env.JALWA_REPAIR_SLUG;
const execution = env.JALWA_REPAIR_RUN;
const scope = "retained-original-repair-20261106";
const staleMarker = "stale_worker_lock_reconciled_20261105";
const failureMarker = "retained_original_repair_failed_20261106";
const licences = {sintel:"CC-BY-3.0", "vhs-static-cc0-clip":"CC0-1.0"};
assert(["inspect", "repair"].includes(mode));
assert.equal(env.DEPLOYMENT_ENVIRONMENT, "staging");
assert.equal(env.MEDIA_BACKEND, "r2");
assert.equal(env.PAYMENT_PROVIDER, "mock");
const release = env.JALWA_REPAIR_EXPECTED_SHA || env.RELEASE_SHA;
assert.match(release, /^[a-f0-9]{40}$/);
assert.equal(env.GIT_SHA, release);
const originals = JSON.parse(env.JALWA_REPAIR_ORIGINALS);
assert.deepEqual(originals.map(item=>item.slug).sort(), Object.keys(licences).sort());
const pool = createPool(env.DATABASE_URL, {max:1, application_name:scope});
const db = await pool.connect();
let claimed = false;
let expected;
let owner;

async function one(sql, args) {
  const result = await db.query(sql, args);
  assert.equal(result.rowCount, 1, "Expected one matching row");
  return result.rows[0];
}

async function candidate(item, lock = false) {
  const content = await one(`select c.*, public.has_publishable_rights(c.id,c.hosting_mode,c.access_level) rights_ok,
    public.is_content_processing_allowed(c.id) processing_ok from public.content_items c
    where c.id=$1 and c.slug=$2 ${lock ? "for update" : ""}`, [item.content_id,item.slug]);
  const asset = await one(`select *, xmin::text revision from public.media_assets
    where id=$1 and content_id=$2 ${lock ? "for update" : ""}`, [item.asset_id,item.content_id]);
  const job = await one(`select *, xmin::text revision from public.media_jobs
    where id=$1 and media_asset_id=$2 ${lock ? "for update" : ""}`, [item.job_id,item.asset_id]);
  assert(content.rights_ok && content.processing_ok, "Rights or processing gate closed");
  assert.equal(content.hosting_mode, "self_host_open");
  assert.equal(content.access_level, "public");
  assert.equal(asset.kind, "source_video");
  assert.equal(Number(asset.size_bytes), Number(item.size_bytes));
  assert.equal(asset.checksum, item.checksum);
  assert.match(asset.checksum, /^[a-f0-9]{64}$/);
  assert(asset.storage_key.startsWith(`incoming/${content.id}/${asset.id}/`));
  assert.equal(asset.metadata.original_filename, item.source.original_filename);
  assert.equal(asset.metadata.source, item.source.source);
  assert.equal(job.job_type, item.job_type);
  assert(!job.cancel_requested, "Job cancelled");
  const rights = await one(`select * from public.rights_records where content_id=$1 and status='approved'
    and not rights_hold and commercial_use_confirmed and self_hosting_confirmed
    and verified_by is not null and verified_at is not null
    and (expires_at is null or expires_at>now()) ${lock ? "for share" : ""}`, [content.id]);
  assert.equal(rights.licence_code, licences[item.slug]);
  const approval = await one(`select exists(select 1 from public.audit_logs
    where entity_id=$1::text and action='rights_approved' and actor_id is not null) ok`, [content.id]);
  assert(approval.ok, "Missing approved-rights audit");
  return {content,asset,job};
}

async function audit(action, details) {
  await db.query(`insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(null,$1,'content_item',$2,$3::jsonb)`, [action,expected.content_id,
    JSON.stringify({scope,run:execution,slug,release:env.GIT_SHA,assetId:expected.asset_id,
      jobId:expected.job_id,originalSourceSha256:expected.checksum,...details})]);
}

function probe(path) {
  const raw = JSON.parse(execFileSync("ffprobe", ["-v","error","-protocol_whitelist","file,pipe,crypto,data",
    "-show_entries","stream=index,codec_type,codec_name,width,height,sample_aspect_ratio:stream_tags=language:format=duration",
    "-of","json",path], {encoding:"utf8",timeout:60000,maxBuffer:1024*1024}));
  const video = raw.streams.find(stream=>stream.codec_type==="video");
  const audio = raw.streams.filter(stream=>stream.codec_type==="audio");
  assert(video?.width && video?.height, "Missing video stream");
  const duration = Number(raw.format.duration);
  assert(Number.isFinite(duration) && duration>0, "Missing media duration");
  return {durationSeconds:duration, width:video.width, height:video.height,
    sampleAspectRatio:video.sample_aspect_ratio || "1:1", codec:video.codec_name,
    audioStreams:audio.length, audioLanguage:audio[0]?.tags?.language || null, hasAudio:audio.length>0};
}

async function sha256(path) {
  const hash = createHash("sha256");
  for await (const chunk of createReadStream(path)) hash.update(chunk);
  return hash.digest("hex");
}

async function saveEvidence(cache, short) {
  await mkdir(env.JALWA_REPAIR_EVIDENCE_DIR,{recursive:true,mode:0o700});
  if (short) {
    execFileSync("ffmpeg",["-nostdin","-y","-v","error","-i",join(cache,"output/short-720.mp4"),
      "-map","0:v:0","-frames:v","1","-q:v","3",
      join(env.JALWA_REPAIR_EVIDENCE_DIR,"vhs-static-output.jpg")],
      {timeout:30000,stdio:["ignore","ignore","pipe"]});
  } else {
    execFileSync("ffmpeg",["-nostdin","-y","-v","error","-sseof","-90","-i",join(cache,"source"),
      "-map","0:v:0","-an","-threads","2","-filter_threads","2",
      "-vf","fps=1/3,scale=1280:-2","-q:v","3",
      join(env.JALWA_REPAIR_EVIDENCE_DIR,"sintel-credit-%03d.jpg")],
      {timeout:90000,stdio:["ignore","ignore","pipe"]});
  }
}

function checkOutput(input, output, duration, tolerance = 1.5) {
  assert.equal(output.codec, "h264");
  assert.equal(output.hasAudio, input.hasAudio, "Audio presence changed");
  assert(Math.abs(output.width/output.height-input.width/input.height)<0.015, "Source aspect ratio changed");
  assert(Math.abs(output.durationSeconds-duration)<tolerance, "Output duration changed unexpectedly");
}

async function requireOwnedJob() {
  const fresh = await candidate(expected);
  assert.equal(fresh.content.status, "editorial_review");
  assert(!fresh.content.is_available && !fresh.asset.is_available);
  assert.equal(fresh.job.status, "processing");
  assert.equal(fresh.job.locked_by, owner);
  assert.equal(fresh.asset.status, "processing");
  assert(!fresh.asset.disabled_at && !fresh.asset.disabled_reason);
  return fresh;
}

try {
  if (mode === "inspect") {
    await db.query("begin transaction read only");
    for (const item of originals) {
      const {content,asset,job} = await candidate(item);
      const object = await verifyObject("incoming",asset.storage_key);
      assert.equal(object.sizeBytes,Number(asset.size_bytes));
      console.log("REPAIR_INSPECT",JSON.stringify({slug:item.slug,contentId:content.id,
        contentStatus:content.status,assetId:asset.id,assetStatus:asset.status,
        jobId:job.id,jobStatus:job.status,attempts:job.attempts,maxAttempts:job.max_attempts,
        sourceBytes:object.sizeBytes,sourceSha256:asset.checksum,sourceMetadata:asset.metadata,
        disabledReason:asset.disabled_reason,lockedBy:job.locked_by,cancelRequested:job.cancel_requested}));
    }
    await db.query("commit");
  } else {
    assert(Object.hasOwn(licences,slug));
    assert.match(execution,/^[1-9]\d*-[1-9]\d*$/);
    assert.equal(env.JALWA_REPAIR_EVIDENCE_DIR,`/tmp/jalwa-retained-evidence-${execution}`);
    expected = originals.find(item=>item.slug===slug);
    owner = `${scope}-${execution}-${slug}`;
    const cache=join("/tmp/jalwa-repair-20261106",expected.asset_id);
    const initial = await candidate(expected);
    const head = await verifyObject("incoming",initial.asset.storage_key);
    assert.equal(head.sizeBytes,Number(expected.size_bytes));
    if (initial.asset.status==="ready" && initial.job.status==="completed") {
      assert.equal(initial.asset.metadata.retainedOriginalRepair?.sourceSha256, expected.checksum);
      const media = await verifyObject("processed",initial.job.output.mediaPath);
      assert(media.sizeBytes>0);
      await saveEvidence(cache,slug==="vhs-static-cc0-clip");
      console.log("REPAIR_ALREADY_READY",JSON.stringify({slug,assetId:expected.asset_id,jobId:expected.job_id}));
    } else {
      await db.query("begin");
      await db.query("set local lock_timeout='8s'");
      await db.query("select pg_advisory_xact_lock(hashtext($1))",["jalwa-retained-repair-"+slug]);
      const before = await candidate(expected,true);
      assert.equal(before.content.status,"editorial_review");
      assert(!before.content.is_available && !before.asset.is_available && !before.asset.disabled_at);
      assert.equal(before.asset.status,"failed");
      assert.equal(before.job.status,"failed");
      assert(!before.job.locked_by && !before.job.locked_at);
      assert(before.job.attempts<before.job.max_attempts,"No retry attempts remain");
      assert([staleMarker,failureMarker].includes(before.asset.disabled_reason),"Unexpected asset disablement");
      if (before.asset.disabled_reason===failureMarker) {
        const ownFailure=await one(`select exists(select 1 from public.audit_logs where entity_id=$1::text
          and action='retained_original_repair_failed' and metadata->>'jobId'=$2::text) ok`,[expected.content_id,expected.job_id]);
        assert(ownFailure.ok,"Failure lacks this repair's audit");
      } else assert(before.job.error_message.startsWith("Orphaned on prior worker-7 session;"));
      const busy=await one(`select count(*)::int count from public.media_jobs
        where status in ('queued','processing') and not cancel_requested`);
      assert.equal(busy.count,0,"Another media job is active");
      const livePlayback=await one(`select count(*)::int count from public.playback_sources
        where content_id=$1 and is_available`,[expected.content_id]);
      assert.equal(livePlayback.count,0);
      await one(`update public.media_jobs set status='processing',attempts=attempts+1,
        locked_by=$2,locked_at=now(),completed_at=null,error_message=null
        where id=$1 and status='failed' and xmin::text=$3 and attempts<max_attempts and not cancel_requested returning id`,
        [expected.job_id,owner,before.job.revision]);
      await one(`update public.media_assets set status='processing',disabled_reason=null
        where id=$1 and status='failed' and xmin::text=$2 and not is_available returning id`,
        [expected.asset_id,before.asset.revision]);
      await audit("retained_original_repair_claimed",{before:{asset:before.asset,job:before.job},owner});
      await db.query("commit");
      claimed=true;

      const source=join(cache,"source");
      const output=join(cache,"output");
      await mkdir(cache,{recursive:true,mode:0o700});
      const cached=await stat(source).catch(()=>null);
      const reused=Boolean(cached && cached.size===head.sizeBytes);
      if (!reused) await downloadObject(before.asset.storage_key,source,"incoming");
      assert.equal((await stat(source)).size,head.sizeBytes);
      assert.equal(await sha256(source),expected.checksum,"Retained original checksum mismatch");
      const input=probe(source);
      const originalVideo=expected.headerProbe.streams.find(stream=>stream.codec_type==="video");
      assert.equal(input.width,originalVideo.width);
      assert.equal(input.height,originalVideo.height);
      assert(Math.abs(input.durationSeconds-Number(expected.headerProbe.format.duration))<0.1);
      assert.equal(input.audioStreams,1,"Expected one retained-original audio stream");
      if (slug==="sintel") assert.equal(input.audioLanguage,"eng");
      await writeFile(join(cache,"source-verified.json"),JSON.stringify({sourceKey:before.asset.storage_key,
        sourceSha256:expected.checksum,sourceBytes:head.sizeBytes,input,verifiedAt:new Date().toISOString()}),{mode:0o600});
      console.log("REPAIR_SOURCE_VERIFIED",JSON.stringify({slug,sourceSha256:expected.checksum,sourceBytes:head.sizeBytes,reused,input,cache}));
      await rm(output,{recursive:true,force:true});
      await mkdir(output,{recursive:true});
      await run("ffmpeg",buildThumbnailArgs(source,join(output,"thumbnail.jpg")),120000);
      const isShort=slug==="vhs-static-cc0-clip";
      const format=isShort ? "mp4" : "hls";
      const prefix=`processed/${expected.content_id}/${expected.asset_id}/`;
      const mediaPath=prefix+(isShort ? "short-720.mp4" : "master.m3u8");
      const targetDuration=isShort ? 45 : input.durationSeconds;
      let outputProbe;
      if (isShort) {
        const target=join(output,"short-720.mp4");
        const args=buildShortArgs(source,target);
        assert(args.includes("scale=w='min(iw,1280)':h='min(ih,1280)':force_original_aspect_ratio=decrease:force_divisible_by=2"));
        args.splice(args.length-1,0,"-t","45");
        await run("ffmpeg",args,15*60*1000);
        outputProbe=probe(target);
        checkOutput(input,outputProbe,targetDuration,0.1);
        assert(outputProbe.width<=input.width && outputProbe.height<=input.height);
      } else {
        for (const size of [360,480,720]) await mkdir(join(output,`${size}p`));
        await run("ffmpeg",buildHlsArgs(source,output,true),60*60*1000);
        for (const size of [360,480,720]) {
          const playlist=join(output,`${size}p/index.m3u8`);
          const text=await readFile(playlist,"utf8");
          assert(text.startsWith("#EXTM3U") && text.includes("#EXT-X-ENDLIST"));
          const current=probe(playlist);
          checkOutput(input,current,targetDuration);
          assert.equal(current.height,size);
          outputProbe=current;
        }
      }
      await saveEvidence(cache,isShort);
      await requireOwnedJob();
      const uploaded=await uploadDirectory(output,prefix);
      const thumbnailPath=prefix+"thumbnail.jpg";
      assert(uploaded.includes(mediaPath) && uploaded.includes(thumbnailPath));
      const finalObject=await verifyObject("processed",mediaPath);
      assert.equal(finalObject.sizeBytes,(await stat(join(output,isShort ? "short-720.mp4" : "master.m3u8"))).size);
      await db.query("begin");
      const final=await candidate(expected,true);
      assert.equal(final.content.status,"editorial_review");
      assert(!final.content.is_available && !final.asset.is_available && !final.asset.disabled_at && !final.asset.disabled_reason);
      assert.equal(final.job.status,"processing");
      assert.equal(final.job.locked_by,owner);
      const repair={scope,run:execution,sourceSha256:expected.checksum,sourceBytes:head.sizeBytes,
        input,output:outputProbe,trimSeconds:isShort ? 45 : null};
      await one(`update public.media_assets set status='ready',is_available=false,duration_seconds=$2,metadata=$3::jsonb
        where id=$1 and status='processing' and xmin::text=$4 returning id`,
        [expected.asset_id,Math.round(outputProbe.durationSeconds),JSON.stringify({...final.asset.metadata,
          probe:{durationSeconds:input.durationSeconds,hasAudio:input.hasAudio},outputs:uploaded,thumbnailPath,
          mediaBackend:"r2",retainedOriginalRepair:repair}),final.asset.revision]);
      await db.query(`update public.playback_sources set is_primary=false,is_available=false where content_id=$1`,[expected.content_id]);
      const playback=await one(`insert into public.playback_sources(content_id,provider,media_asset_id,media_url,format,is_primary,is_available,status)
        values($1,'original',$2,$3,$4,true,false,'active') returning id`,[expected.content_id,expected.asset_id,mediaPath,format]);
      await one(`update public.media_jobs set status='completed',completed_at=now(),locked_at=null,locked_by=null,error_message=null,output=$3::jsonb
        where id=$1 and status='processing' and locked_by=$2 and not cancel_requested returning id`,
        [expected.job_id,owner,JSON.stringify({mediaPath,thumbnailPath,format,uploaded,probe:outputProbe,mediaBackend:"r2",retainedOriginalRepair:repair})]);
      await audit("retained_original_repair_completed",{owner,playbackId:playback.id,mediaPath,format,repair,sourcePreserved:true});
      await db.query("commit");
      claimed=false;
      console.log("REPAIR_READY",JSON.stringify({slug,assetId:expected.asset_id,jobId:expected.job_id,playbackId:playback.id,
        format,sourceSha256:expected.checksum,input,output:outputProbe,cache}));
    }
  }
} catch (error) {
  await db.query("rollback").catch(()=>{});
  if (claimed) {
    await db.query("begin");
    const failed=await db.query(`update public.media_jobs set status='failed',completed_at=now(),locked_at=null,locked_by=null,error_message=$3
      where id=$1 and status='processing' and locked_by=$2 returning id`,[expected.job_id,owner,failureMarker+": "+String(error.message).slice(0,3000)]);
    if (failed.rowCount===1) {
      await db.query(`update public.media_assets set status='failed',is_available=false,disabled_reason=coalesce(disabled_reason,$2)
        where id=$1 and status='processing'`,[expected.asset_id,failureMarker]);
      await audit("retained_original_repair_failed",{owner,error:String(error.message).slice(0,3000),originalPreserved:true});
    }
    await db.query("commit");
  }
  console.error("REPAIR_BLOCKED",slug || "inspect",error.message);
  process.exitCode=1;
} finally { db.release(); await pool.end(); }
