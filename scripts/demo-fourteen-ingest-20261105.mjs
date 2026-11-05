(async function jalwaFourteenOperator() {
 const assert = (await import("node:assert/strict")).default;
 const { mkdtemp, rm, stat, open }=await import("node:fs/promises");
 const { createWriteStream, createReadStream }=await import("node:fs");
 const { Readable, Transform }=await import("node:stream");
 const { pipeline }=await import("node:stream/promises");
 const { join }=await import("node:path");
 const { tmpdir }=await import("node:os");
 const { createHash,randomUUID }=await import("node:crypto");
 const { execFileSync }=await import("node:child_process");
 const { createPool }=await import("/app/packages/postgres/index.mjs");
 const { uploadSourceFile,verifyObject }=await import("/app/apps/worker/src/storage.mjs");
 const mode=process.env.DEMO_14_MODE, slug=process.env.DEMO_14_SLUG;
 assert.ok(["ingest","ready","publish","rollback"].includes(mode));
 assert.equal(process.env.DEPLOYMENT_ENVIRONMENT,"staging");
 assert.equal(process.env.MEDIA_BACKEND,"r2");
 assert.equal(process.env.PAYMENT_PROVIDER,"mock");
 const sha=process.env.DEMO_14_EXPECTED_SHA;
 assert.match(sha||"",/^[a-f0-9]{40}$/);
 assert.equal(process.env.GIT_SHA,sha,"Runtime release changed: abort without content writes");
 const allowedSlugs=[
 "artemis-ii-lunar-flyby-svs","artemis-ii-trajectory-svs","hd-earth-views-svs",
 "hst-fly-by-nasa","hst-sm4-rendezvous-nasa","earth-views-from-iss-nasa","apollo-11-eagle-has-landed",
 "sprite-fright","spring-blender","cosmos-laundromat","caminandes-llamigos",
 "grca-south-rim-summer-timelapse","grca-animals-broll","grca-south-rim-winter-scenic"];
 assert.ok(allowedSlugs.includes(slug),"Title not on approved 14-source list");
 const manifest=JSON.parse(process.env.DEMO_14_MANIFEST||"null");
 assert.equal(manifest?.schemaVersion,1);
 assert.equal(manifest?.titles?.length,14);
 const item=manifest.titles.find(x=>x.slug===slug);
 assert.ok(item&&item.ext&&item.mime&&item.page);
 const pool=createPool(process.env.DATABASE_URL,{max:2,application_name:"jalwa_demo_14_ingest"});
 const limit=350*1024*1024; 
 function official(url){
  const u=new URL(url);
  return u.protocol==="https:"&&["svs.gsfc.nasa.gov","images-assets.nasa.gov","www.nps.gov","video.blender.org"].includes(u.hostname)&&!u.username&&!u.password;
 }
 async function resolve(){
  if(item.kind==="direct"){assert.ok(official(item.uri));return item.uri;}
  assert.equal(item.kind,"nasa");
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),18000);
  let doc;
  try{
   const res=await fetch("https://images-api.nasa.gov/asset/"+encodeURIComponent(item.nasaId),{signal:controller.signal});
   assert.equal(res.status,200,"Official NASA API failed");doc=await res.json();
  }finally{clearTimeout(timer);}
  const urls=(doc.collection?.items||[]).map(x=>x.href?.replace(/^http:/,"https:")).filter(u=>u&&official(u)&&u.endsWith(".mp4"));
  for(const ending of item.prefer||[]){const hit=urls.find(u=>u.endsWith(ending));if(hit)return hit;}
  throw Error("NASA asset manifest lacks the approved small MP4 variant "+slug);
 }
 async function getRow(db=pool){
  const c=await db.query([
   "select c.id,c.slug,c.status::text status,c.content_type::text content_type,",
   "c.hosting_mode::text hosting_mode,c.access_level::text access_level,c.is_available,",
   "c.duration_seconds,public.has_publishable_rights(c.id,c.hosting_mode,c.access_level) publishable,",
   "public.is_content_processing_allowed(c.id) processing_allowed,",
   "exists(select 1 from public.rights_records rr where rr.content_id=c.id and rr.status='approved'",
   "and rr.rights_hold=false and rr.self_hosting_confirmed=true and rr.commercial_use_confirmed=true) rights_approved",
   "from public.content_items c where c.slug=$1"
  ].join(" "),[slug]);
  assert.equal(c.rows.length,1,"Exactly one item required");
  const row=c.rows[0];
  assert.equal(row.hosting_mode,"self_host_open");
  assert.equal(row.access_level,"public");
  assert.equal(row.rights_approved,true,"No individually approved rights");
  assert.equal(row.publishable,true,"Rights publication gate is closed");
  assert.equal(row.processing_allowed,true,"Rights processing gate closed");
  assert.ok(["video","short"].includes(row.content_type));
  assert.ok(["editorial_review","published"].includes(row.status));
  const q=await db.query([
   "select a.id asset_id,a.status::text asset_status,a.is_available asset_available,a.storage_key,a.size_bytes,",
   "j.id job_id,j.status::text job_status,j.job_type::text job_type,j.attempts,j.error_message,",
   "p.media_url,p.format::text format,p.is_available playback_available,p.is_primary",
   "from public.media_assets a left join lateral",
   "(select * from public.media_jobs where media_asset_id=a.id order by created_at desc limit 1) j on true",
   "left join lateral (select media_url,format,is_available,is_primary from public.playback_sources",
   "where content_id=a.content_id and media_asset_id=a.id and is_primary=true limit 1) p on true",
   "where a.content_id=$1 and a.kind='source_video' order by a.created_at desc limit 1"
  ].join(" "),[row.id]);
  return {...row,asset:q.rows[0]||null};
 }
 async function audit(db,action,row,metadata){
  await db.query("insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values (null,$1,'content_item',$2,$3::jsonb)",
   [action,row.id,JSON.stringify({slug,scope:"internal-demo-only",rightsPreserved:true,release:sha,...metadata})]);
 }
 async function ingest(){
  const row=await getRow();
  if(row.status==="published"&&row.is_available){console.log("DEMO_14_ALREADY_PUBLISHED "+JSON.stringify({slug}));return;}
  if(row.asset){
   if(["queued","processing","ready"].includes(row.asset.asset_status)){
    console.log("DEMO_14_ALREADY_INGESTED "+JSON.stringify({slug,status:row.asset.asset_status,job:row.asset.job_status}));return;
   }
   throw Error("Existing failed/unknown source asset for "+slug+"; refuse duplicate upload");
  }
  assert.equal(row.status,"editorial_review");
  assert.equal(row.is_available,false);
  const sourceUrl=await resolve();assert.ok(official(sourceUrl));
  const dir=await mkdtemp(join(tmpdir(),"jalwa-14-")),local=join(dir,"source."+item.ext);
  let bytes=0,hash=createHash("sha256"),duration;
  try{
   const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),12*60*1000);
   try{
    const response=await fetch(sourceUrl,{signal:controller.signal,headers:{"user-agent":"JalwaInternalDemo/1.0; approved item-level intake"}});
    assert.equal(response.status,200,"Official file unavailable (HTTP)");
    assert.ok(official(response.url),"Publisher redirected outside allowlist");
    const declared=Number(response.headers.get("content-length")||0);
    assert.ok(!declared||(declared>1000&&declared<=limit),"Publisher file exceeds bounded 350MB intake limit");
    assert.ok(response.body);
    const meter=new Transform({transform(chunk,_,callback){
      bytes+=chunk.length;
      if(bytes>limit){controller.abort();callback(Error("Official source exceeds 350 MB"));return;}
      hash.update(chunk);callback(null,chunk);
    }});
    await pipeline(Readable.fromWeb(response.body),meter,createWriteStream(local));
   }finally{clearTimeout(timer);}
   assert.ok(bytes>2000&&bytes<=limit);
   const probe=JSON.parse(execFileSync("ffprobe",["-v","error","-show_entries","stream=codec_type,width,height:format=duration","-of","json",local],
      {encoding:"utf8",timeout:60000,maxBuffer:5000000}));
   const video=probe.streams?.find(s=>s.codec_type==="video");
   duration=Number(probe.format?.duration);
   assert.ok(video?.width>=128&&video?.height>=128,"Source has no playable video");
   assert.ok(Number.isFinite(duration)&&duration>=3&&duration<=7200,"Invalid video duration");
   const sourceHash=hash.digest("hex");
   const assetId=randomUUID(),key="incoming/"+row.id+"/"+assetId+"/source."+item.ext;
   await uploadSourceFile(local,key,item.mime,bytes);
   const o=await verifyObject("incoming",key);
   assert.equal(o.sizeBytes,bytes,"R2 size mismatch");
   const db=await pool.connect();
   try{
    await db.query("begin");
    await db.query("select pg_advisory_xact_lock(hashtext($1))",["jalwa-demo14-"+slug]);
    const current=await getRow(db);
    assert.equal(current.asset,null,"Concurrent media ingestion detected");
    assert.equal(current.status,"editorial_review");
    const jobType=current.content_type==="short"||duration<=90?"short_mp4":"hls";
    const asset=await db.query([
     "insert into public.media_assets(id,content_id,kind,status,storage_key,mime_type,size_bytes,checksum,is_available,metadata)",
     "values($1,$2,'source_video','queued',$3,$4,$5,$6,false,$7::jsonb) returning id"
    ].join(" "),[assetId,current.id,key,item.mime,bytes,sourceHash,JSON.stringify({
      sourceUrl,sourcePage:item.page,pipeline:jobType,origin:"approved-internal-demo-20261105",sourceWidth:video.width,sourceHeight:video.height,durationSeconds:duration,
      sourceBytes:bytes,retainsRights:true
    })]);
    assert.equal(asset.rowCount,1);
    const job=await db.query("insert into public.media_jobs(media_asset_id,job_type,status) values($1,$2::public.media_job_type,'queued') returning id",[assetId,jobType]);
    assert.equal(job.rowCount,1);
    await audit(db,"demo_14_official_source_ingested",current,{assetId,jobId:job.rows[0].id,sourceBytes:bytes,sourceSha256:sourceHash,jobType,sourcePage:item.page,sourceUrl});
    await db.query("commit");
    console.log("DEMO_14_QUEUED "+JSON.stringify({slug,assetId,job:job.rows[0].id,bytes,jobType,sourceUrl,duration,width:video.width,height:video.height}));
   }catch(e){await db.query("rollback").catch(()=>{});throw e}finally{db.release();}
  }finally{await rm(dir,{recursive:true,force:true});}
 }
 async function ready(){
  const row=await getRow();
  if(row.status==="published"&&row.is_available){console.log("DEMO_14_ALREADY_PUBLISHED "+JSON.stringify({slug}));return;}
  const a=row.asset;
  if(!a){console.log("DEMO_14_NOT_READY "+JSON.stringify({slug,reason:"no_asset"}));process.exitCode=3;return;}
  if(a.asset_status!=="ready"||a.job_status!=="completed"){
   console.log("DEMO_14_NOT_READY "+JSON.stringify({slug,asset:a.asset_status,job:a.job_status,error:(a.error_message||"").slice(0,150)}));
   process.exitCode=a.asset_status==="failed"?4:3;return;
  }
  assert.ok(a.is_primary&&a.media_url&&a.asset_id);
  assert.ok(["mp4","hls"].includes(a.format));
  const prefix="processed/"+row.id+"/"+a.asset_id+"/";
  const expected=a.format==="hls"?prefix+"master.m3u8":prefix+"short-720.mp4";
  assert.equal(a.media_url,expected);
  const head=await verifyObject("processed",expected);
  assert.ok(head.sizeBytes>1000,"Missing processed object");
  console.log("DEMO_14_READY "+JSON.stringify({slug,asset:a.asset_id,format:a.format,bytes:head.sizeBytes,mediaPath:expected}));
 }
 async function publish(){
  let row=await getRow(),a=row.asset;
  if(row.status==="published"&&row.is_available){console.log("DEMO_14_ALREADY_PUBLISHED "+JSON.stringify({slug}));return;}
  assert.equal(row.status,"editorial_review");assert.equal(row.is_available,false);
  assert.equal(a?.asset_status,"ready");assert.equal(a.job_status,"completed");
  assert.ok(a.is_primary&&!a.playback_available);
  assert.ok(a.media_url.startsWith("processed/"+row.id+"/"+a.asset_id+"/"));
  const head=await verifyObject("processed",a.media_url);
  assert.ok(head.sizeBytes>1000);
  const db=await pool.connect();
  try{
   await db.query("begin");
   await db.query("select pg_advisory_xact_lock(hashtext($1))",["jalwa-demo14-"+slug]);
   row=await getRow(db);a=row.asset;
   assert.equal(row.status,"editorial_review");
   assert.equal(a.asset_status,"ready");
   const one=await db.query("update public.media_assets set is_available=true,disabled_at=null,disabled_reason=null where id=$1 and status='ready' returning id",[a.asset_id]);assert.equal(one.rowCount,1);
   await db.query("update public.playback_sources set is_available=false where content_id=$1 and media_asset_id is distinct from $2",[row.id,a.asset_id]);
   const two=await db.query("update public.playback_sources set is_primary=true,is_available=true,status='active',disabled_at=null,disabled_reason=null where content_id=$1 and media_asset_id=$2 and format=$3 returning id",[row.id,a.asset_id,a.format]);assert.equal(two.rowCount,1);
   const three=await db.query("update public.content_items set status='published',is_available=true,publish_at=coalesce(publish_at,now()),unpublish_at=null,disabled_at=null,disabled_reason=null,updated_at=now() where id=$1 and status='editorial_review' and public.has_publishable_rights(id,hosting_mode,access_level) returning id",[row.id]);assert.equal(three.rowCount,1);
   await audit(db,"demo_14_media_published",row,{assetId:a.asset_id,format:a.format,sourcePage:item.page,mediaPath:a.media_url});
   await db.query("commit");
   console.log("DEMO_14_PUBLISHED "+JSON.stringify({slug,assetId:a.asset_id,format:a.format,bytes:head.sizeBytes}));
  }catch(e){await db.query("rollback").catch(()=>{});throw e}finally{db.release();}
 }
 async function rollback(){
  const db=await pool.connect();
  try{
   await db.query("begin");
   await db.query("select pg_advisory_xact_lock(hashtext($1))",["jalwa-demo14-"+slug]);
   const row=await getRow(db),a=row.asset;
   if(row.status==="editorial_review"&&!row.is_available){await db.query("commit");console.log("DEMO_14_ALREADY_UNPUBLISHED "+slug);return;}
   assert.equal(row.status,"published");
   const action=await db.query("select id from public.audit_logs where entity_id=$1 and action='demo_14_media_published' and metadata->>'assetId'=$2 order by created_at desc limit 1",[row.id,a.asset_id]);
   assert.equal(action.rows.length,1,"No activation record: cannot rollback another title");
   const p=await db.query("update public.playback_sources set is_available=false where content_id=$1 and media_asset_id=$2 and is_primary=true returning id",[row.id,a.asset_id]);assert.equal(p.rowCount,1);
   await db.query("update public.media_assets set is_available=false where id=$1",[a.asset_id]);
   await db.query("update public.content_items set status='editorial_review',is_available=false,updated_at=now() where id=$1",[row.id]);
   await audit(db,"demo_14_failed_qa_rollback",row,{assetId:a.asset_id,sourcePreserved:true});
   await db.query("commit");
   console.log("DEMO_14_UNPUBLISHED "+slug);
  }catch(e){await db.query("rollback").catch(()=>{});throw e}finally{db.release();}
 }
 try{
  if(mode==="ingest")await ingest();
  else if(mode==="ready")await ready();
  else if(mode==="publish")await publish();
  else await rollback();
 }catch(e){console.error("DEMO_14_ERROR "+String(e?.message||e));process.exitCode=1}
 finally{await pool.end();}
})().catch(e=>{console.error(e);process.exitCode=1});
