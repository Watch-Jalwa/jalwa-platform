import assert from "node:assert/strict";
import { createPool } from "/app/packages/postgres/index.mjs";
assert.equal(process.env.DEPLOYMENT_ENVIRONMENT, "staging");
assert.equal(process.env.GIT_SHA, process.env.RELEASE_SHA);
const db = createPool(process.env.DATABASE_URL, {max:1});
try {
  const slugs = ["artemis-ii-lunar-flyby-svs","artemis-ii-trajectory-svs","hd-earth-views-svs","hst-fly-by-nasa","hst-sm4-rendezvous-nasa","earth-views-from-iss-nasa","grca-south-rim-summer-timelapse","grca-animals-broll","grca-south-rim-winter-scenic","spring-blender","sprite-fright","caminandes-llamigos","apollo-11-eagle-has-landed","cosmos-laundromat"];
  const result = await db.query(`select c.slug, c.status, c.is_available, public.is_content_effectively_available(c.id) as effective,
    p.is_available as playback, a.is_available as asset, a.status as media_status, p.format
    from public.content_items c join public.playback_sources p on p.content_id=c.id and p.is_primary
    join public.media_assets a on a.id=p.media_asset_id where c.slug=any($1::text[]) order by c.slug`,[slugs]);
  assert.deepEqual(result.rows.map(r=>r.slug),slugs.sort());
  assert(result.rows.every(r=>r.status==="published" && r.is_available && r.effective && r.playback && r.asset && r.media_status==="ready" && ["hls","mp4"].includes(r.format)));
  const reviewed=await db.query(`select c.audience,c.duration_seconds,r.licence_code,r.evidence_url
    from public.content_items c join public.rights_records r on r.content_id=c.id and r.status='approved'
    where c.slug='cosmos-laundromat'`);
  assert.equal(reviewed.rowCount,1);
  const cosmos=reviewed.rows[0];
  assert.equal(cosmos.audience,"teens");
  assert.equal(cosmos.duration_seconds,731);
  assert.equal(cosmos.licence_code,"CC-BY-4.0");
  assert.equal(cosmos.evidence_url,"https://github.com/Watch-Jalwa/jalwa-platform/actions/runs/42188424728/artifacts/13489052274");
  console.log(JSON.stringify({release:process.env.GIT_SHA,titles:result.rows,cosmosEditorial:cosmos},null,2));
} finally {await db.end();}
