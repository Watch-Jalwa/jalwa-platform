import assert from 'node:assert/strict';
import {createReadStream} from 'node:fs';
import {createHash} from 'node:crypto';
import {copyFile,mkdir,readFile,readdir,rm,stat,statfs} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join} from 'node:path';
import {createPool} from '/app/packages/postgres/index.mjs';
import {verifyObject,uploadDirectory} from '/app/apps/worker/src/storage.mjs';
import {run} from '/app/apps/worker/src/media.mjs';

const env=process.env;
assert.equal(env.DEPLOYMENT_ENVIRONMENT,'staging');
assert.equal(env.MEDIA_BACKEND,'r2');
assert.equal(env.PAYMENT_PROVIDER,'mock');
assert.equal(env.GIT_SHA,env.RELEASE_SHA);
assert.match(env.RELEASE_SHA,/^[a-f0-9]{40}$/);
assert.match(env.JALWA_REPAIR_RUN,/^[1-9]\d*-[1-9]\d*$/);
const original=JSON.parse(env.JALWA_REPAIR_ORIGINALS).find(item=>item.slug==='sintel');
assert.equal(original.asset_id,'5c5f576c-d1d6-4898-9bd5-2e3616fd0001');
const scope='retained-audio-packaging-20261106';
const owner=scope+'-'+env.JALWA_REPAIR_RUN;
const cache=join('/tmp/jalwa-repair-20261106',original.asset_id);
const source=join(cache,'source');
const previous=join(cache,'output');
const output=join(cache,'audio-output');
const pool=createPool(env.DATABASE_URL,{max:1,application_name:scope});
const db=await pool.connect();
let claimed=false;

async function one(sql,args) {
  const result=await db.query(sql,args);
  assert.equal(result.rowCount,1,'Expected one matching record');
  return result.rows[0];
}
async function candidate(lock=false) {
  const c=await one(`select *,public.has_publishable_rights(id,hosting_mode,access_level) rights_ok,
    public.is_content_processing_allowed(id) processing_ok from public.content_items
    where id=$1 and slug='sintel' ${lock?'for update':''}`,[original.content_id]);
  const a=await one(`select *,xmin::text revision from public.media_assets where id=$1 and content_id=$2 ${lock?'for update':''}`,[original.asset_id,c.id]);
  const j=await one(`select *,xmin::text revision from public.media_jobs where id=$1 and media_asset_id=$2 ${lock?'for update':''}`,[original.job_id,a.id]);
  const p=await one(`select * from public.playback_sources where content_id=$1 and media_asset_id=$2 and is_primary ${lock?'for update':''}`,[c.id,a.id]);
  assert(c.rights_ok&&c.processing_ok&&!c.disabled_at&&!c.disabled_reason);
  assert.equal(c.status,'editorial_review');
  assert.equal(c.hosting_mode,'self_host_open');
  assert.equal(c.access_level,'public');
  assert(!c.is_available&&!a.is_available&&!p.is_available);
  assert.equal(a.checksum,original.checksum);
  assert.equal(Number(a.size_bytes),Number(original.size_bytes));
  assert.equal(a.metadata.original_filename,original.source.original_filename);
  assert.equal(a.metadata.source,original.source.source);
  assert.equal(a.metadata.retainedOriginalRepair.sourceSha256,original.checksum);
  assert.equal(a.kind,'source_video');assert.equal(j.job_type,'hls');assert.equal(p.status,'active');
  assert(a.storage_key.startsWith(`incoming/${c.id}/${a.id}/`));
  assert(!a.disabled_at&&!j.cancel_requested&&!p.disabled_at&&!p.disabled_reason);
  assert.equal(p.format,'hls');
  assert.equal(p.media_url,`processed/${c.id}/${a.id}/master.m3u8`);
  const r=await one(`select * from public.rights_records where content_id=$1 and status='approved'
    and not rights_hold and self_hosting_confirmed and commercial_use_confirmed
    and verified_by is not null and verified_at is not null
    and (expires_at is null or expires_at>now()) ${lock?'for share':''}`,[c.id]);
  assert.equal(r.licence_code,'CC-BY-3.0');
  const approved=await one(`select exists(select 1 from public.audit_logs where entity_id=$1::text
    and action='rights_approved' and actor_id is not null) ok`,[c.id]);
  assert(approved.ok);
  return {c,a,j,p};
}
async function audit(action,details) {
  await db.query(`insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata)
    values(null,$1,'content_item',$2,$3::jsonb)`,[action,original.content_id,JSON.stringify({scope,
    run:env.JALWA_REPAIR_RUN,release:env.GIT_SHA,assetId:original.asset_id,jobId:original.job_id,
    sourceSha256:original.checksum,...details})]);
}
function probe(file,extra=['-show_entries','stream=codec_type,codec_name,width,height,channels,channel_layout,sample_rate:format=duration']) {
  return JSON.parse(execFileSync('ffprobe',['-v','error',...extra,'-of','json',file],{encoding:'utf8',timeout:60000,maxBuffer:4*1024*1024}));
}
function firstPts(file,selector) {
  const result=probe(file,['-select_streams',selector,'-read_intervals','%+1','-show_packets','-show_entries','packet=pts_time']);
  const pts=Number(result.packets[0].pts_time);
  assert(Number.isFinite(pts));
  return pts;
}
function videoHash(file) {
  return execFileSync('ffmpeg',['-nostdin','-v','error','-i',file,'-map','0:v:0','-c:v','copy','-an','-f','hash','-hash','sha256','-'],
    {encoding:'utf8',timeout:120000,maxBuffer:1024*1024,stdio:['ignore','pipe','pipe']}).trim();
}
async function bytesIn(directory) {
  let bytes=0;
  for(const entry of await readdir(directory,{withFileTypes:true})) {
    const file=join(directory,entry.name);
    bytes+=entry.isDirectory()?await bytesIn(file):(await stat(file)).size;
  }
  return bytes;
}
try {
  const initial=await candidate();
  assert.equal(initial.a.status,'ready');
  assert.equal(initial.j.status,'completed');
  assert(!initial.a.disabled_reason&&!initial.j.locked_by&&!initial.j.locked_at);
  const retained=await verifyObject('incoming',initial.a.storage_key);
  assert.equal(retained.sizeBytes,Number(original.size_bytes));
  assert.equal((await stat(source)).size,retained.sizeBytes);
  const checksum=createHash('sha256');
  for await(const chunk of createReadStream(source))checksum.update(chunk);
  assert.equal(checksum.digest('hex'),original.checksum);
  await rm(output,{recursive:true,force:true});
  const free=await statfs(cache);
  const required=Math.ceil(await bytesIn(previous)*1.1)+128*1024*1024;
  assert(free.bavail*free.bsize>=required,'Insufficient worker scratch for video-copy audio repair');
  await mkdir(output,{recursive:true});
  const sourceVideoPts=firstPts(source,'v:0');
  const sourceAudioPts=firstPts(source,'a:0');
  const sourceAudio=probe(source).streams.find(stream=>stream.codec_type==='audio');
  assert.equal(sourceAudio.channels,6);
  assert.equal(sourceAudio.codec_name,'ac3');
  const sizes=[360,480,720];
  const args=['-nostdin','-y','-copyts','-filter_threads','2','-threads','2','-i',source];
  const offsets=[];
  for(const size of sizes) {
    const input=join(previous,`${size}p/index.m3u8`);
    const offset=sourceVideoPts-firstPts(input,'v:0');
    offsets.push({size,offset});
    args.push('-itsoffset',String(offset),'-threads','2','-i',input);
    await mkdir(join(output,`${size}p`));
  }
  for(let index=1;index<=3;index++)args.push('-map',`${index}:v:0`,'-map','0:a:0');
  args.push('-c:v','copy','-c:a','aac','-channel_layout:a','5.1','-b:a','128k','-threads','2',
    '-f','hls','-hls_time','6','-hls_playlist_type','vod','-hls_flags','independent_segments',
    '-master_pl_name','master.m3u8','-var_stream_map','v:0,a:0,name:360p v:1,a:1,name:480p v:2,a:2,name:720p',
    '-hls_segment_filename',join(output,'%v/segment-%05d.ts'),join(output,'%v/index.m3u8'));
  console.log('AUDIO_REPAIR_STARTED',JSON.stringify({sourceSha256:original.checksum,sourceAudio,sourceVideoPts,sourceAudioPts,offsets,availableBytes:free.bavail*free.bsize,requiredBytes:required}));
  await run('ffmpeg',args,10*60*1000);
  const master=await readFile(join(output,'master.m3u8'),'utf8');
  assert(master.startsWith('#EXTM3U'));
  assert.deepEqual(master.split(/\r?\n/).filter(line=>line&&!line.startsWith('#')).sort(),['360p/index.m3u8','480p/index.m3u8','720p/index.m3u8']);
  await copyFile(join(previous,'thumbnail.jpg'),join(output,'thumbnail.jpg'));
  const evidence=[];
  for(const size of sizes) {
    const playlist=join(output,`${size}p/index.m3u8`);
    const text=await readFile(playlist,'utf8');
    assert(text.startsWith('#EXTM3U')&&text.includes('#EXT-X-ENDLIST'));
    const segments=text.split(/\r?\n/).filter(line=>/^segment-\d{5}\.ts$/.test(line));
    const duration=[...text.matchAll(/^#EXTINF:([\d.]+),/gm)].reduce((sum,match)=>sum+Number(match[1]),0);
    assert(Math.abs(duration-888.032)<1,'Full film duration changed');
    const beforeHash=videoHash(join(previous,`${size}p/index.m3u8`));
    assert.equal(videoHash(playlist),beforeHash,'Encoded video packets changed during audio repair');
    const sync=firstPts(playlist,'v:0')-firstPts(playlist,'a:0');
    assert(Math.abs(sync-(sourceVideoPts-sourceAudioPts)-1024/48000)<0.005,'A/V alignment changed beyond AAC priming');
    const samples=[segments[0],segments[Math.floor(segments.length/2)],segments.at(-1)];
    for(const segment of samples) {
      const file=join(output,`${size}p`,segment);
      const streams=probe(file).streams;
      const video=streams.find(stream=>stream.codec_type==='video');
      const audio=streams.find(stream=>stream.codec_type==='audio');
      assert.equal(video.height,size);
      assert(Math.abs(video.width/video.height-1280/544)<0.015);
      assert.equal(audio.codec_name,'aac');assert.equal(audio.channels,6);
      assert.equal(audio.channel_layout,'5.1');assert.equal(audio.sample_rate,'48000');
      execFileSync('ffmpeg',['-nostdin','-v','warning','-xerror','-threads','2','-filter_threads','2',
        '-i',file,'-map','0:v:0','-map','0:a:0','-threads','2','-f','null','-'],
        {timeout:90000,stdio:['ignore','ignore','pipe']});
    }
    const row={size,duration,videoPacketHash:beforeHash,sourceRelativeSync:sourceVideoPts-sourceAudioPts,outputRelativeSync:sync,independentlyDecoded:samples};
    evidence.push(row);console.log('AUDIO_VARIANT_VERIFIED',JSON.stringify(row));
  }
  await db.query('begin');
  await db.query("set local lock_timeout='8s'");
  const before=await candidate(true);
  assert.equal(before.a.status,'ready');assert.equal(before.j.status,'completed');
  assert.equal(before.a.revision,initial.a.revision);assert.equal(before.j.revision,initial.j.revision);
  const busy=await one("select count(*)::int count from public.media_jobs where status in ('queued','processing') and not cancel_requested");
  assert.equal(busy.count,0);
  // Repackage the completed encode under its existing job and audit history.
  await one("update public.media_assets set status='processing' where id=$1 and xmin::text=$2 returning id",[original.asset_id,before.a.revision]);
  await one("update public.media_jobs set status='processing',locked_by=$2,locked_at=now(),completed_at=null where id=$1 and xmin::text=$3 returning id",[original.job_id,owner,before.j.revision]);
  await audit('retained_audio_packaging_started',{owner,before:{asset:before.a,job:before.j},evidence});
  await db.query('commit');claimed=true;
  const prefix=`processed/${original.content_id}/${original.asset_id}/`;
  const uploaded=await uploadDirectory(output,prefix);
  assert(uploaded.includes(prefix+'master.m3u8')&&uploaded.includes(prefix+'thumbnail.jpg'));
  const storedMaster=await verifyObject('processed',prefix+'master.m3u8');
  assert.equal(storedMaster.sizeBytes,(await stat(join(output,'master.m3u8'))).size);
  await db.query('begin');
  const final=await candidate(true);
  assert.equal(final.a.status,'processing');assert.equal(final.j.locked_by,owner);
  const packaging={scope,run:env.JALWA_REPAIR_RUN,sourceSha256:original.checksum,channels:6,channelLayout:'5.1',videoCopied:true,evidence};
  const metadata={...final.a.metadata,outputs:uploaded,retainedOriginalRepair:{...final.a.metadata.retainedOriginalRepair,audioPackaging:packaging}};
  await one("update public.media_assets set status='ready',metadata=$2::jsonb where id=$1 and xmin::text=$3 returning id",[original.asset_id,JSON.stringify(metadata),final.a.revision]);
  const jobOutput={...final.j.output,uploaded,retainedOriginalRepair:metadata.retainedOriginalRepair,audioPackaging:packaging};
  await one("update public.media_jobs set status='completed',completed_at=now(),locked_by=null,locked_at=null,error_message=null,output=$3::jsonb where id=$1 and locked_by=$2 returning id",[original.job_id,owner,JSON.stringify(jobOutput)]);
  await audit('retained_audio_packaging_completed',{owner,packaging,sourcePreserved:true});
  await db.query('commit');claimed=false;
  console.log('AUDIO_REPAIR_COMPLETE',JSON.stringify(packaging));
} catch(error) {
  await db.query('rollback').catch(()=>{});
  if(claimed) {
    await db.query('begin');
    const job=await db.query("update public.media_jobs set status='failed',locked_by=null,locked_at=null,error_message=$3 where id=$1 and locked_by=$2 returning id",[original.job_id,owner,scope+': '+error.message]);
    if(job.rowCount===1) {
      await db.query("update public.media_assets set status='failed',disabled_reason=$2 where id=$1 and status='processing'",[original.asset_id,scope]);
      await audit('retained_audio_packaging_failed',{owner,error:error.message});
    }
    await db.query('commit');
  }
  console.error('AUDIO_REPAIR_BLOCKED',JSON.stringify({message:error.message,status:error.status,signal:error.signal,stderr:error.stderr?.toString().slice(-6000)}));
  process.exitCode=1;
} finally {db.release();await pool.end();}
