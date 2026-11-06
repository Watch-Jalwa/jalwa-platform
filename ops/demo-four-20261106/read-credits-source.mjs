import assert from "node:assert/strict";
import {createPool} from "/app/packages/postgres/index.mjs";
import {downloadObject} from "/app/apps/worker/src/storage.mjs";
import {createReadStream} from "node:fs";
import {mkdtemp,rm,stat} from "node:fs/promises";
import {pipeline} from "node:stream/promises";
const db=createPool(process.env.DATABASE_URL,{max:1});
const dir=await mkdtemp("/tmp/jalwa-credits-");
try{
  assert.equal(process.env.DEPLOYMENT_ENVIRONMENT,"staging");
  const res=await db.query(`select a.storage_key,a.size_bytes from public.media_assets a join public.content_items c on c.id=a.content_id where c.slug='sprite-fright' and a.kind='source_video' and a.status='ready' and a.metadata->>'sourcePage'='https://studio.blender.org/films/sprite-fright/'`);
  assert.equal(res.rowCount,1);
  const row=res.rows[0];assert(row.storage_key.startsWith("incoming/") && +row.size_bytes < 367001600);
  await downloadObject(row.storage_key,dir+"/source.mp4","incoming");
  assert.equal((await stat(dir+"/source.mp4")).size,+row.size_bytes);
  await pipeline(createReadStream(dir+"/source.mp4"),process.stdout);
}finally{await rm(dir,{recursive:true,force:true});await db.end();}
