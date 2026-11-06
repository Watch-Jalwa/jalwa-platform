import assert from "node:assert/strict";
import { createPool } from "/app/packages/postgres/index.mjs";
assert.equal(process.env.DEPLOYMENT_ENVIRONMENT,"staging");
assert.equal(process.env.MEDIA_BACKEND,"r2");
assert.equal(process.env.PAYMENT_PROVIDER,"mock");
assert.equal(process.env.GIT_SHA,process.env.RELEASE_SHA);
const originals=JSON.parse(process.env.JALWA_REPAIR_ORIGINALS);
assert.equal(originals.length,2);
const db=createPool(process.env.DATABASE_URL,{max:1});
try {
  const q=await db.query(`select c.id,c.slug,c.status,c.is_available,c.duration_seconds,c.audience,c.thumbnail_url,
    public.is_content_effectively_available(c.id) as effective,
    p.is_available as playback,p.format,a.id as asset_id,a.status as media_status,a.is_available as asset,
    a.checksum,a.size_bytes,a.metadata->'retainedOriginalRepair' as repair,
    j.id as job_id,j.status as job_status,r.licence_code
    from public.content_items c join public.playback_sources p on p.content_id=c.id and p.is_primary
    join public.media_assets a on a.id=p.media_asset_id
    join public.media_jobs j on j.media_asset_id=a.id and j.id=any($2::uuid[])
    join public.rights_records r on r.content_id=c.id and r.status='approved'
    where c.slug=any($1::text[]) order by c.slug`,[originals.map(r=>r.slug),originals.map(r=>r.job_id)]);
  assert.equal(q.rowCount,2);
  for(const r of q.rows) {
    const source=originals.find(x=>x.slug===r.slug);
    assert.equal(r.id,source.content_id);
    assert.equal(r.asset_id,source.asset_id);
    assert.equal(r.job_id,source.job_id);
    assert.equal(r.checksum,source.checksum);
    assert.equal(Number(r.size_bytes),Number(source.size_bytes));
    assert(r.status==='published' && r.is_available && r.effective && r.playback && r.asset);
    assert.equal(r.media_status,'ready');assert.equal(r.job_status,'completed');
    assert.equal(r.repair.sourceSha256,source.checksum);
    assert.equal(r.duration_seconds,r.slug==='sintel'?888:45);
    assert.equal(r.thumbnail_url,'/api/catalogue/poster/'+r.id);
    assert.equal(r.licence_code,r.slug==='sintel'?'CC-BY-3.0':'CC0-1.0');
    if(r.slug==='sintel') {
      assert.equal(r.repair.audioPackaging.sourceSha256,source.checksum);
      assert.equal(r.repair.audioPackaging.channels,6);
      assert.equal(r.repair.audioPackaging.channelLayout,'5.1');
      assert(r.repair.audioPackaging.videoCopied);
      assert.equal(r.repair.audioPackaging.evidence.length,3);
      assert(r.repair.audioPackaging.evidence.every(item=>item.independentlyDecoded.length===3));
    }
  }
  console.log(JSON.stringify({release:process.env.GIT_SHA,titles:q.rows},null,2));
} finally {await db.end();}
