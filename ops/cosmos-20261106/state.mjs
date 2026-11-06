import assert from "node:assert/strict";
import {createPool} from "/app/packages/postgres/index.mjs";
assert.equal(process.env.DEPLOYMENT_ENVIRONMENT,"staging");
assert.equal(process.env.GIT_SHA,process.env.DEMO_14_EXPECTED_SHA);
const db=createPool(process.env.DATABASE_URL,{max:1});
try {
  const q=await db.query(`select c.id,c.slug,c.status,c.is_available,public.has_publishable_rights(c.id,c.hosting_mode,c.access_level) as rights_ok,
    public.is_content_processing_allowed(c.id) as process_ok,
    a.status as asset_status,a.is_available as asset_available,a.metadata->'probe' as source_probe,
    j.status as job_status,j.error_message
    from public.content_items c left join public.media_assets a on a.content_id=c.id and a.kind='source_video'
    left join lateral(select j.status,j.error_message from public.media_jobs j where j.media_asset_id=a.id order by created_at desc limit 1) j on true
    where c.slug='cosmos-laundromat'`);
  assert.equal(q.rowCount,1,"Unexpected Cosmos assets");
  const r=q.rows[0];
  assert(r.rights_ok&&r.process_ok,"Rights or publication gates closed");
  console.log("COSMOS_STATE "+JSON.stringify(r));
  if(r.asset_status==="failed"||r.job_status==="failed"||r.job_status==="cancelled") process.exitCode=1;
  else if(r.asset_status!=="ready"||r.job_status!=="completed") process.exitCode=3;
} finally {await db.end();}
