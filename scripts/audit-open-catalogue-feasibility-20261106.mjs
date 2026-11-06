// Read-only technical proof of three real Pakistan-relevant, documented source files.
// Source APIs -> legal metadata flag -> complete authorized download -> SHA256 -> ffprobe -> HLS.
// Creates local CI evidence only. NEVER modifies Jalwa DB, R2, rights, or public catalogue.
import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import {createWriteStream} from "node:fs";
import {mkdtemp,mkdir,readFile,readdir,writeFile,stat,rm} from "node:fs/promises";
import {Readable,Transform} from "node:stream";
import {pipeline} from "node:stream/promises";
import {tmpdir} from "node:os";
import {join} from "node:path";
import {execFileSync} from "node:child_process";

const candidates=[
  {slug:"birds-of-pakistan-part-3",kind:"commons",title:"File:Birds of Pakistan - Part 3.webm",license:"CC BY 3.0",maxBytes:40e6},
  {slug:"ansu-lake-visit",kind:"commons",title:"File:Ansu Lake Visit Video.ogv",license:"CC BY-SA 3.0",maxBytes:40e6},
  {slug:"promise-of-pakistan-1950",kind:"archive",id:"gov.archives.arc.641839",file:"gov.archives.arc.641839.mp4",license:"http://creativecommons.org/publicdomain/zero/1.0/",maxBytes:125e6}
];
const ROOT="audit-evidence/pakistan-technical-poc";
await mkdir(ROOT,{recursive:true});
const metadataHeaders={"user-agent":"JalwaOpenContentTechnicalAudit/2026-11-06 (source verification, no bulk mirror)"};
function jsonFetch(url,timeoutMs=22000){
 return fetch(url,{headers:metadataHeaders,signal:AbortSignal.timeout(timeoutMs)})
 .then(async response=>{assert.equal(response.status,200,"Metadata fetch failed "+response.status+" "+url);return response.json()});
}
function cleanHTML(input){return String(input||"").replace(/<[^>]*>/g," ").replace(/&amp;/g,"&").trim()}
async function discover(c){
 if(c.kind==="commons"){
   const q=new URL("https://commons.wikimedia.org/w/api.php");
   q.searchParams.set("action","query");q.searchParams.set("format","json");
   q.searchParams.set("prop","imageinfo");q.searchParams.set("iiprop","url|size|mime|extmetadata");
   q.searchParams.set("titles",c.title);
   const payload=await jsonFetch(q.href);
   const page=Object.values(payload.query.pages)[0];
   assert.ok(!page.missing&&page.imageinfo?.length===1,"Missing Commons source");
   const img=page.imageinfo[0],rights=img.extmetadata||{};
   const license=cleanHTML(rights.LicenseShortName?.value);
   assert.equal(license,c.license,"Wikimedia current licence differs from approved POC assumption");
   assert.ok(img.size>1000&&img.size<=c.maxBytes);
   const url=new URL(img.url);
   assert.equal(url.protocol,"https:");
   assert.equal(url.hostname,"upload.wikimedia.org");
   return {sourcePage:img.descriptionurl,sourceUrl:url.href,sizeBytes:img.size,
     author:cleanHTML(rights.Artist?.value),attribution:cleanHTML(rights.Attribution?.value),
     license,licenseUrl:rights.LicenseUrl?.value,licenseAuthority:"Wikimedia file-page uploader metadata; underlying rights not guaranteed",container:img.mime};
 }
 const response=await jsonFetch("https://archive.org/metadata/"+c.id,30000);
 assert.equal(response.metadata?.identifier,c.id);
 assert.equal(response.metadata?.licenseurl,c.license);
 const file=response.files?.find(x=>x.name===c.file);
 assert.ok(file,"Archive MP4 derivative missing");
 assert.ok(Number(file.size)>1000&&Number(file.size)<=c.maxBytes);
 return {sourcePage:"https://archive.org/details/"+c.id,
   sourceUrl:"https://archive.org/download/"+c.id+"/"+encodeURIComponent(c.file),
   sizeBytes:Number(file.size),author:String(response.metadata.creator||"US National Archives"),
   attribution:"US National Archives / Internet Archive",
   license:"CC0-marked by Archive",licenseUrl:response.metadata.licenseurl,
   licenseAuthority:"Internet Archive record and US federal work provenance; territorial rights need validation",
   container:"video/mp4"};
}
async function fullDownload(remote,destination,declared,maxBytes){
 const signal=AbortSignal.timeout(8*60*1000);
 const response=await fetch(remote,{headers:metadataHeaders,redirect:"follow",signal});
 assert.equal(response.status,200,"Video source denied download "+response.status);
 assert.ok(response.body);
 const host=new URL(response.url).hostname;
 assert.ok(host==="upload.wikimedia.org"||host==="archive.org"||host.endsWith(".archive.org"),"Disallowed download redirect "+host);
 const h=createHash("sha256");let bytes=0;
 const meter=new Transform({transform(chunk,_enc,cb){bytes+=chunk.length;
    if(bytes>maxBytes){cb(Error("Bounded POC source too large"));return;}
    h.update(chunk);cb(null,chunk);
 }});
 await pipeline(Readable.fromWeb(response.body),meter,createWriteStream(destination));
 assert.equal(bytes,declared,"Downloaded file length does not match official source metadata");
 return{bytes,sha256:h.digest("hex"),finalSourceHost:host,httpStatus:response.status};
}
function run(program,args){return execFileSync(program,args,{encoding:"utf8",timeout:180000,maxBuffer:7e6})}
function probe(src){
 const data=JSON.parse(run("ffprobe",["-v","error","-show_entries",
  "stream=codec_type,codec_name,width,height:format=duration,format_name","-of","json",src]));
 const video=data.streams?.find(x=>x.codec_type==="video");
 assert.ok(video&&video.width>=128&&video.height>=128,"Video missing/undecodable");
 const seconds=Number(data.format?.duration);
 assert.ok(seconds>=10&&seconds<9000,"Unexpected duration");
 return {durationSeconds:Math.round(seconds*100)/100,resolution:video.width+"x"+video.height,
   codec:video.codec_name,container:data.format.format_name,
   audioCodec:data.streams?.find(x=>x.codec_type==="audio")?.codec_name||null,
   maxHeight:video.height};
}
async function transcodeSamples(original,details,outDir,c){
 const heights=c.slug==="birds-of-pakistan-part-3"?[360,480,720]:[240];
 const playlists=[];
 for(const height of heights){
   if(height>details.maxHeight)continue;
   const folder=join(outDir,String(height)+"p");
   await mkdir(folder,{recursive:true});
   const playlist=join(folder,"index.m3u8");
   const args=["-nostdin","-hide_banner","-loglevel","error","-y","-i",original,"-t","10",
     "-vf","scale=-2:"+height+":flags=bicubic","-pix_fmt","yuv420p","-c:v","libx264",
     "-preset","veryfast","-crf","27","-c:a","aac","-b:a","96k",
     "-g","48","-keyint_min","48","-sc_threshold","0","-f","hls","-hls_time","2",
     "-hls_playlist_type","vod","-hls_segment_filename",join(folder,"part_%03d.ts"),playlist];
   run("ffmpeg",args);
   const content=await readFile(playlist,"utf8");
   assert.ok(content.includes("#EXTM3U")&&content.includes("#EXT-X-ENDLIST"),"HLS invalid");
   const segments=(await readdir(folder)).filter(x=>x.endsWith(".ts"));
   assert.ok(segments.length>=2,"No generated HLS segments");
   const segment=join(folder,segments[0]);
   const dec=probeSegment(segment);
   assert.ok(dec.videoHeight<=details.maxHeight,"Upscaled video unexpectedly");
   playlists.push({height,segments:segments.length,codec:dec.codec,videoHeight:dec.videoHeight,
     segmentBytes:(await stat(segment)).size});
 }
 assert.ok(playlists.length>0);
 const master=["#EXTM3U","#EXT-X-VERSION:3"];
 for(const p of playlists){
  master.push("#EXT-X-STREAM-INF:BANDWIDTH="+p.height*1450+",RESOLUTION="+
    (p.height===720?"1280x720":p.height===480?"854x480":p.height===360?"640x360":"320x240"));
  master.push(p.height+"p/index.m3u8");
 }
 await writeFile(join(outDir,"master.m3u8"),master.join("\n")+"\n");
 return playlists;
}
function probeSegment(source){
 const x=JSON.parse(run("ffprobe",["-v","error","-show_entries","stream=codec_type,codec_name,width,height","-of","json",source]));
 const v=x.streams?.find(s=>s.codec_type==="video");
 assert.ok(v?.width>=100&&v?.height>=100);
 return{codec:v.codec_name,videoWidth:v.width,videoHeight:v.height};
}
const evidence=[],dir=await mkdtemp(join(tmpdir(),"jalwa-content-poc-"));
try{
 for(const c of candidates){
  const t={slug:c.slug,testedAt:new Date().toISOString(),downloadStatus:"NOT_TESTED",hlsStatus:"NOT_TESTED",
     rightsStatus:"candidate; manual underlying-media/territory/attribution review required before Jalwa production"};
  try{
   const found=await discover(c);
   t.discovery="PASS";t.source=found;
   const local=join(dir,c.slug+".source");
   const receipt=await fullDownload(found.sourceUrl,local,found.sizeBytes,c.maxBytes);
   t.downloadStatus="PASS";t.download=receipt;
   t.ffprobe=probe(local);
   const hlsDir=join(ROOT,c.slug);await mkdir(hlsDir,{recursive:true});
   t.playlists=await transcodeSamples(local,t.ffprobe,hlsDir,c);
   t.hlsStatus="PASS";
  }catch(e){t.error=String(e?.message||e).slice(0,300);console.error("OPEN_SOURCE_POC_FAIL "+JSON.stringify({slug:c.slug,error:t.error}));}
  evidence.push(t);console.log("OPEN_SOURCE_POC_RESULT "+JSON.stringify({slug:t.slug,discovery:t.discovery,download:t.downloadStatus,
    ffprobe:t.ffprobe,hls:t.hlsStatus,variants:t.playlists?.length,error:t.error}));
 }
}finally{await rm(dir,{recursive:true,force:true});}
await writeFile(join(ROOT,"evidence.json"),JSON.stringify({
  scope:"Standalone GitHub CI technical test, NO Jalwa source ingestion/publishing",testedAt:new Date().toISOString(),
  sampleCount:evidence.length,successCount:evidence.filter(x=>x.downloadStatus==="PASS"&&x.hlsStatus==="PASS").length,
  note:"Technical source tests do not constitute final independent film rights clearance. Original films are not redistributed in this artifact.",
  evidence
},null,2));
if(evidence.some(x=>x.downloadStatus!=="PASS"||x.hlsStatus!=="PASS"))process.exitCode=1;
