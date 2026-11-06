import assert from "node:assert/strict";
import {createPool} from "/app/packages/postgres/index.mjs";
const e=process.env;
assert.equal(e.DEPLOYMENT_ENVIRONMENT,"staging");
const db=createPool(e.DATABASE_URL,{max:1});
try {
 const client=await db.connect();
 try {
  await client.query("begin read only");
  const slugs=["apollo-11-eagle-has-landed","caminandes-llamigos","spring-blender","sprite-fright"];
  const rows=await client.query(`select c.slug,c.title_en,c.description_en,c.description_ur,c.audience,c.status,c.is_available,
   r.licence_code,r.evidence_url,r.attribution_text from public.content_items c join public.rights_records r on r.content_id=c.id and r.status='approved'
   where c.slug=any($1::text[]) order by c.slug`,[slugs]);
  for (const row of rows.rows) console.log("EDITORIAL",JSON.stringify(row));
  const allowed=(e.STAGING_QA_ALLOWED_EMAILS||"").toLowerCase().split(",").map(s=>s.trim()).filter(Boolean);
  const counts=await client.query(`select lower(u.email)=lower($2) as configured_customer,
    count(distinct x.benefit_code)::int as benefit_count from public."user" u
    left join public.entitlements x on x.user_id=u.id and x.status='active' and x.starts_at<=now() and x.ends_at>now()
    and x.benefit_code in ('premium_catalogue','enhanced_quality')
    where lower(u.email)=any($1::text[]) group by u.id,u.email order by benefit_count desc`,[allowed,"acceptance+customer@watch-jalwa.com"]);
  console.log("ALLOWLIST_PREMIUM_STATUS",JSON.stringify(counts.rows));
  await client.query("rollback");
 }finally{client.release();}
}finally{await db.end();}
