// One-time atomic demo playback switch to an already verified immutable R2 object.
// No re-encoding, deletes, rights writes, subscriptions or other titles touched.
import assert from "node:assert/strict";
import { createPool } from "/app/packages/postgres/index.mjs";
import { verifyObject } from "/app/apps/worker/src/storage.mjs";
const SLUG="baking-cookies-cc0";
const OLD="processed/6bbec55e-c2fb-4784-9b5b-c01e931dbb26/5383b3a1-cfa7-4119-b2cc-78a11119a83b/short-720.mp4";
const NEXT="processed/6bbec55e-c2fb-4784-9b5b-c01e931dbb26/5383b3a1-cfa7-4119-b2cc-78a11119a83b/aspect-v2-407118cffc6f-20f559c3/short-720.mp4";
assert.equal(process.env.DEPLOYMENT_ENVIRONMENT,"staging");
assert.equal(process.env.PAYMENT_PROVIDER,"mock");
assert.equal(process.env.MEDIA_BACKEND,"r2");
assert.equal(process.env.GIT_SHA,"ec0a76f8efd3d9cf0a64e864d264be6d274deb34");
const oldHead=await verifyObject("processed",OLD);
const nextHead=await verifyObject("processed",NEXT);
assert.equal(oldHead.sizeBytes,309536);
assert.equal(nextHead.sizeBytes,1091787);
const pool=createPool(process.env.DATABASE_URL,{max:2,application_name:"jalwa_demo_aspect_pilot_activate"});
const db=await pool.connect();
try {
  await db.query("begin");
  await db.query("select pg_advisory_xact_lock(hashtext($1))",["jalwa-demo-aspect-"+SLUG]);
  const sql=[
   "select c.id as content_id,c.status::text content_status,p.id as playback_id,",
   "p.media_url,p.format::text format,r.licence_code,r.status::text rights_status,",
   "r.self_hosting_confirmed,r.commercial_use_confirmed,r.rights_hold",
   "from public.content_items c",
   "join public.playback_sources p on p.content_id=c.id and p.is_primary=true",
   "join public.rights_records r on r.content_id=c.id and r.status='approved'",
   "where c.slug=$1 for update of p"
  ].join(" ");
  const rows=(await db.query(sql,[SLUG])).rows;
  assert.equal(rows.length,1,"Expected one approved primary playback");
  const current=rows[0];
  assert.equal(current.content_status,"published");
  assert.equal(current.format,"mp4");
  assert.equal(current.media_url,OLD,"Playback already moved; refuse overwrite");
  assert.equal(current.licence_code,"CC0-1.0");
  assert.equal(current.self_hosting_confirmed,true);
  assert.equal(current.commercial_use_confirmed,true);
  assert.equal(current.rights_hold,false);
  const changed=await db.query(
    "update public.playback_sources set media_url=$1 where id=$2 and media_url=$3 returning id",
    [NEXT,current.playback_id,OLD]
  );
  assert.equal(changed.rowCount,1);
  await db.query(
    "insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values (null,$1,'content_item',$2,$3::jsonb)",
    ["demo_media_aspect_pilot_activated",current.content_id,JSON.stringify({
      demoOnly:true,slug:SLUG,oldMediaKey:OLD,newMediaKey:NEXT,
      approval:"owner-authorized-internal-demo-2026-11-05",licence:"CC0-1.0",
      expectedImageSha:process.env.GIT_SHA,sourceHashPrefix:"407118cffc6f",
      previousBytes:oldHead.sizeBytes,newBytes:nextHead.sizeBytes
    })]
  );
  await db.query("commit");
  console.log("PILOT_PROMOTED "+JSON.stringify({
    slug:SLUG,release:process.env.GIT_SHA,oldMediaKey:OLD,newMediaKey:NEXT,
    oldPreserved:true,rightsRecordsUnchanged:true,updatedOnePrimary:true
  }));
} catch(e) {
  await db.query("rollback").catch(()=>{});
  throw e;
} finally {
  db.release();
  await pool.end();
}
