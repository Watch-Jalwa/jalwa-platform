// Read-only Jalwa demo original-source and licensing inventory.
// Executed inside the existing worker container with its normal R2 configuration.
// Prints no R2 keys, playback token, full media URLs, database credentials or user data.
import { createPool } from "/app/packages/postgres/index.mjs";
import { verifyObject } from "/app/apps/worker/src/storage.mjs";

const slugs = [
  "mossy-tree-cc0", "baking-cookies-cc0", "ocean-surface-waves-cc0", "tiny-waterfall-cc0",
  "tree-trimmer-cc0", "counting-chisenbop-cc0", "vanellus-vanellus-cc0",
  "how-fossils-form-cc-by", "eso-cast-254-light", "eso-cast-265-light",
  "proxima-centauri-flythrough-cc-by", "invitation-to-pakistan-nara",
  "promise-of-pakistan-geography", "wikipedia-science-comms-cc-by",
  "big-buck-bunny", "elephants-dream"
];
const pool = createPool(process.env.DATABASE_URL, {max: 2, application_name:"jalwa_demo_original_source_readonly"});
async function head(kind, key) {
  if (!key) return { exists:false, reason:"missing_key" };
  try {
    const info = await verifyObject(kind, key);
    return {exists:true, bytes:info.sizeBytes, contentType:info.contentType || null};
  } catch(e) {
    return {exists:false, reason:e?.name || "head_failed", httpStatus:e?.$metadata?.httpStatusCode ?? null};
  }
}
try {
  const client = await pool.connect();
  let records = [];
  try {
    await client.query("begin transaction read only");
    const sql = [
      "select ci.slug, ci.status::text content_status, ci.hosting_mode::text hosting_mode,",
      "p.media_url, p.format::text format, p.id playback_id, p.media_asset_id,",
      "ma.storage_key, ma.kind::text media_kind, ma.status::text media_status,",
      "ma.width, ma.height, ma.size_bytes,",
      "r.licence_code, r.status::text rights_status, r.self_hosting_confirmed,",
      "r.modification_confirmed, r.commercial_use_confirmed, r.rights_hold",
      "from public.content_items ci",
      "left join lateral (select * from public.playback_sources ps where ps.content_id=ci.id and ps.is_primary=true order by ps.id limit 1) p on true",
      "left join public.media_assets ma on ma.id=p.media_asset_id",
      "left join lateral (select * from public.rights_records rr where rr.content_id=ci.id and rr.status='approved' order by rr.verified_at desc nulls last limit 1) r on true",
      "where ci.slug=any($1::text[]) order by ci.slug"
    ].join(" ");
    const result = await client.query(sql,[slugs]);
    records=result.rows;
    await client.query("rollback");
  } finally {
    client.release();
  }
  for (const slug of slugs) {
    const record=records.find(r=>r.slug===slug);
    if(!record){console.log("MEDIA_INVENTORY "+JSON.stringify({slug,found:false}));continue;}
    const incoming=await head("incoming",record.storage_key);
    const processed=await head("processed",record.media_url);
    console.log("MEDIA_INVENTORY "+JSON.stringify({
      slug,found:true,contentStatus:record.content_status,hostingMode:record.hosting_mode,
      format:record.format,mediaKind:record.media_kind,assetStatus:record.media_status,
      assetSize:record.size_bytes,assetWidth:record.width,assetHeight:record.height,
      licence:record.licence_code,rightsStatus:record.rights_status,
      selfHostingAllowed:record.self_hosting_confirmed,
      modificationAllowed:record.modification_confirmed,
      commercialAllowed:record.commercial_use_confirmed,rightsHold:record.rights_hold,
      incoming,processed,
    }));
  }
} finally {await pool.end();}
