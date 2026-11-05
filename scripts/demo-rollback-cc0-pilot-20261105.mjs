// Idempotent single-title rollback from demo aspect pilot; never deletes R2 objects.
import assert from "node:assert/strict";
import { createPool } from "/app/packages/postgres/index.mjs";
import { verifyObject } from "/app/apps/worker/src/storage.mjs";
const SLUG="baking-cookies-cc0";
const OLD="processed/6bbec55e-c2fb-4784-9b5b-c01e931dbb26/5383b3a1-cfa7-4119-b2cc-78a11119a83b/short-720.mp4", NEXT="processed/6bbec55e-c2fb-4784-9b5b-c01e931dbb26/5383b3a1-cfa7-4119-b2cc-78a11119a83b/aspect-v2-407118cffc6f-20f559c3/short-720.mp4";
assert.equal(process.env.DEPLOYMENT_ENVIRONMENT,"staging");
assert.equal(process.env.PAYMENT_PROVIDER,"mock");
assert.equal((await verifyObject("processed",OLD)).sizeBytes,309536);
const pool=createPool(process.env.DATABASE_URL,{max:2,application_name:"jalwa_demo_aspect_rollback"});
const db=await pool.connect();
try {
  await db.query("begin");
  await db.query("select pg_advisory_xact_lock(hashtext($1))",["jalwa-demo-aspect-"+SLUG]);
  const q=await db.query(
    "select c.id content_id,p.id playback_id,p.media_url from public.content_items c join public.playback_sources p on p.content_id=c.id and p.is_primary where c.slug=$1 for update of p",
    [SLUG]
  );
  assert.equal(q.rows.length,1);
  const current=q.rows[0];
  if (current.media_url===OLD) {
    await db.query("commit");
    console.log("PILOT_ROLLBACK_NOT_NEEDED "+SLUG);
  } else {
    assert.equal(current.media_url,NEXT,"Unexpected media pointer; refuse to roll back an unrelated change");
    const updated=await db.query(
      "update public.playback_sources set media_url=$1 where id=$2 and media_url=$3 returning id",
      [OLD,current.playback_id,NEXT]);
    assert.equal(updated.rowCount,1);
    await db.query(
      "insert into public.audit_logs(actor_id,action,entity_type,entity_id,metadata) values (null,$1,'content_item',$2,$3::jsonb)",
      ["demo_media_aspect_pilot_rolled_back",current.content_id,JSON.stringify({
        demoOnly:true,slug:SLUG,restoredMediaKey:OLD,replacedMediaKey:NEXT,
        preservedCandidate:true,reason:"post-activation acceptance failed"
      })]
    );
    await db.query("commit");
    console.log("PILOT_ROLLED_BACK "+JSON.stringify({slug:SLUG,restoredOldKey:true,candidatePreserved:true}));
  }
} catch(e) {await db.query("rollback").catch(()=>{});throw e}
finally{db.release();await pool.end();}
