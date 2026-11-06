import assert from "node:assert/strict";
import {createPool} from "/app/packages/postgres/index.mjs";
import {downloadObject} from "/app/apps/worker/src/storage.mjs";
import {mkdtemp,rm,stat,readdir} from "node:fs/promises";
import {execFileSync,spawn} from "node:child_process";
import {pipeline} from "node:stream/promises";
assert.equal(process.env.DEPLOYMENT_ENVIRONMENT,"staging");
assert.equal(process.env.GIT_SHA,process.env.RELEASE_SHA);
const db=createPool(process.env.DATABASE_URL,{max:1});
const dir=await mkdtemp("/tmp/jalwa-cosmos-credits-");
try{
 const q=await db.query(`select a.storage_key,a.size_bytes,a.metadata from public.media_assets a
   join public.content_items c on c.id=a.content_id
   where c.slug='cosmos-laundromat' and a.kind='source_video' and a.status='ready'`);
 assert.equal(q.rowCount,1);
 const r=q.rows[0];assert(r.storage_key.startsWith("incoming/") && +r.size_bytes<367001600);
 assert.equal(new URL(r.metadata.sourceUrl).hostname,"video.blender.org");
 const file=dir+"/source.mp4";
 await downloadObject(r.storage_key,file,"incoming");
 assert.equal((await stat(file)).size,+r.size_bytes);
 execFileSync("ffmpeg",["-nostdin","-hide_banner","-loglevel","error","-sseof","-90","-i",file,"-threads","2","-filter_threads","2","-vf","fps=1/3,scale=1280:-1","-q:v","3",dir+"/credit-%03d.jpg"],{timeout:90000,stdio:["ignore","ignore","pipe"]});
 const frames=(await readdir(dir)).filter(f=>/^credit-\d{3}\.jpg$/.test(f));
 assert(frames.length>0);
 const tar=spawn("tar",["-czf","-","-C",dir,...frames],{stdio:["ignore","pipe","inherit"]});
 const completion=new Promise((resolve,reject)=>{tar.on("error",reject);tar.on("close",code=>code===0?resolve():reject(Error("Tar failed")))});
 await pipeline(tar.stdout,process.stdout);await completion;
} finally {await rm(dir,{recursive:true,force:true});await db.end();}
