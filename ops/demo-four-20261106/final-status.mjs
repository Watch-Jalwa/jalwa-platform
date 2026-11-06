import assert from "node:assert/strict";
import { createPool } from "/app/packages/postgres/index.mjs";
assert.equal(process.env.DEPLOYMENT_ENVIRONMENT, "staging");
assert.equal(process.env.GIT_SHA, process.env.RELEASE_SHA);
const db = createPool(process.env.DATABASE_URL, {max:1});
try {
  const slugs = ["spring-blender", "sprite-fright", "caminandes-llamigos", "apollo-11-eagle-has-landed"];
  const result = await db.query(`select c.slug, c.status, c.is_available, public.is_content_effectively_available(c.id) as effective,
    p.is_available as playback, a.is_available as asset, a.status as media_status, p.format
    from public.content_items c join public.playback_sources p on p.content_id=c.id and p.is_primary
    join public.media_assets a on a.id=p.media_asset_id where c.slug=any($1::text[]) order by c.slug`,[slugs]);
  assert.deepEqual(result.rows.map(r=>r.slug),slugs.sort());
  assert(result.rows.every(r=>r.status==="published" && r.is_available && r.effective && r.playback && r.asset && r.media_status==="ready" && r.format==="hls"));
  console.log(JSON.stringify({release:process.env.GIT_SHA,titles:result.rows},null,2));
} finally {await db.end();}
