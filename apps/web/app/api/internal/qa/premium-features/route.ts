import { NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { databasePool } from "@/lib/database/pool";
import { stagingQaAuthorized } from "../_guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const FIXTURES = {
  premium: { id: "00000000-0000-4000-8000-00000000a101", asset: "00000000-0000-4000-8000-00000000b101", slug: "qa-premium-catalogue-title" },
  early: { id: "00000000-0000-4000-8000-00000000a102", asset: "00000000-0000-4000-8000-00000000b102", slug: "qa-premium-early-access-original" },
  quality: { id: "00000000-0000-4000-8000-00000000a103", asset: "00000000-0000-4000-8000-00000000b103", slug: "qa-playback-quality-title" },
  collection: { id: "00000000-0000-4000-8000-00000000c101", slug: "qa-premium-collection" },
};

async function cleanup(client: PoolClient) {
  await client.query("delete from public.collections where id=$1 or slug=$2", [FIXTURES.collection.id, FIXTURES.collection.slug]);
  await client.query("delete from public.content_items where id=any($1::uuid[]) or slug=any($2::text[])", [
    [FIXTURES.premium.id, FIXTURES.early.id, FIXTURES.quality.id],
    [FIXTURES.premium.slug, FIXTURES.early.slug, FIXTURES.quality.slug],
  ]);
}

async function insertFixture(
  client: PoolClient,
  input: { id: string; asset: string; slug: string; title: string; access: "public" | "premium"; categoryId: string; future?: boolean },
) {
  await client.query(
    `insert into public.content_items(id,slug,content_type,hosting_mode,access_level,status,title_en,description_en,primary_category_id,language,duration_seconds,audience,is_featured,is_available,publish_at)
     values($1,$2,'video','self_host_open',$3,'draft',$4,'Deterministic staging fixture for Premium benefit certification.',$5,'en',120,'general',false,true,$6)`,
    [input.id, input.slug, input.access, input.title, input.categoryId, input.future ? new Date(Date.now() + 7 * 86400000).toISOString() : new Date().toISOString()],
  );
  await client.query(
    `insert into public.rights_records(content_id,source_url,creator,licence_code,attribution_text,evidence_url,evidence_note,takedown_contact,commercial_use_confirmed,modification_confirmed,self_hosting_confirmed,embedding_confirmed,status,verified_at)
     values($1,'https://watch-jalwa.com/qa-fixture','Jalwa QA','JALWA-QA','Jalwa QA staging fixture','https://watch-jalwa.com/qa-fixture/rights','Synthetic staging-only fixture with explicit rights evidence for Premium certification.','qa-rights@watch-jalwa.com',true,true,true,true,'approved',now())`,
    [input.id],
  );
  const mediaPath = `processed/${input.id}/${input.asset}/master.m3u8`;
  await client.query(
    `insert into public.media_assets(id,content_id,kind,status,storage_key,mime_type,width,height,duration_seconds,metadata,is_available)
     values($1,$2,'hls_manifest','ready',$3,'application/vnd.apple.mpegurl',1280,720,120,'{"qa_fixture":true}'::jsonb,true)`,
    [input.asset, input.id, mediaPath],
  );
  await client.query(
    `insert into public.playback_sources(content_id,provider,media_url,is_primary,status,media_asset_id,format,is_available)
     values($1,'original',$2,true,'active',$3,'hls',true)`,
    [input.id, mediaPath, input.asset],
  );
  await client.query("update public.content_items set status='published' where id=$1", [input.id]);
}

export async function POST(request: Request) {
  if (!stagingQaAuthorized(request)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const body = await request.json().catch(() => ({})) as { premiumUserId?: string; freeUserId?: string };
  if (!body.premiumUserId || !body.freeUserId || !uuidPattern.test(body.premiumUserId) || !uuidPattern.test(body.freeUserId) || body.premiumUserId === body.freeUserId) {
    return NextResponse.json({ error: "Valid distinct Premium/free QA user IDs are required." }, { status: 400 });
  }
  const client = await databasePool.connect();
  try {
    await client.query("begin");
    await cleanup(client);
    // This route is staging-only and token-protected. Reset only the two deterministic QA
    // identities so repeated certification cannot inherit stale browser registrations.
    await client.query("delete from public.user_devices where user_id=any($1::uuid[])", [[body.premiumUserId, body.freeUserId]]);
    const category = await client.query("select id from public.categories where slug='originals' limit 1");
    const categoryId = category.rows[0]?.id;
    if (!categoryId) throw new Error("Jalwa Originals category is unavailable.");

    await insertFixture(client, { ...FIXTURES.premium, title: "QA Premium Catalogue Title", access: "premium", categoryId });
    await insertFixture(client, { ...FIXTURES.early, title: "QA Early Access Jalwa Original", access: "premium", categoryId, future: true });
    await insertFixture(client, { ...FIXTURES.quality, title: "QA Playback Quality Title", access: "public", categoryId });

    await client.query(
      `insert into public.collections(id,slug,title_en,description_en,access_level,status,publish_at)
       values($1,$2,'QA Premium Collection','Deterministic Premium-only staging collection.','premium','published',now())`,
      [FIXTURES.collection.id, FIXTURES.collection.slug],
    );
    await client.query("insert into public.collection_items(collection_id,content_id,sort_order) values($1,$2,0)", [FIXTURES.collection.id, FIXTURES.premium.id]);
    await client.query("commit");
    return NextResponse.json({ ok: true, fixtures: FIXTURES }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Premium QA fixture setup failed." }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(request: Request) {
  if (!stagingQaAuthorized(request)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const client = await databasePool.connect();
  try {
    await client.query("begin");
    await cleanup(client);
    await client.query("commit");
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    return NextResponse.json({ error: error instanceof Error ? error.message : "Premium QA fixture cleanup failed." }, { status: 500 });
  } finally {
    client.release();
  }
}
