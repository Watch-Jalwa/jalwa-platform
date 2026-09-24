import { NextResponse } from "next/server";
import type { PoolClient } from "pg";
import { databasePool } from "@/lib/database/pool";
import { stagingQaAuthorized } from "../_guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const premiumFixture = {
  premiumContentId: "11111111-1111-4111-8111-111111111101",
  qualityContentId: "11111111-1111-4111-8111-111111111102",
  earlyAccessContentId: "11111111-1111-4111-8111-111111111103",
  premiumAssetId: "11111111-1111-4111-8111-111111111201",
  qualityAssetId: "11111111-1111-4111-8111-111111111202",
  premiumCollectionId: "11111111-1111-4111-8111-111111111301",
  premiumSlug: "qa-premium-catalogue",
  qualitySlug: "qa-premium-quality",
  earlyAccessSlug: "qa-premium-early-access",
  premiumCollectionSlug: "qa-premium-collection",
} as const;

async function clearPremiumFixture(client: PoolClient) {
  await client.query(`delete from public.collections where id=$1`, [premiumFixture.premiumCollectionId]);
  await client.query(`delete from public.content_items where id=any($1::uuid[])`, [[
    premiumFixture.premiumContentId,
    premiumFixture.qualityContentId,
    premiumFixture.earlyAccessContentId,
  ]]);
}

export async function GET(request: Request) {
  if (!stagingQaAuthorized(request)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") ?? "";
  if (kind === "active-price") {
    const result = await databasePool.query(`select id,plan_id,code,amount_minor,currency from public.prices where is_active=true order by amount_minor asc limit 1`);
    return NextResponse.json({ data: result.rows[0] ?? null }, { headers: { "Cache-Control": "no-store" } });
  }
  if (kind === "plan") {
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const result = await databasePool.query(`select id,benefits from public.plans where id=$1 limit 1`, [id]);
    return NextResponse.json({ data: result.rows[0] ?? null }, { headers: { "Cache-Control": "no-store" } });
  }
  if (kind === "checkout-order") {
    const id = url.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const result = await databasePool.query(`select id,user_id,price_id,amount_minor,currency,status,provider from public.checkout_orders where id=$1 limit 1`, [id]);
    return NextResponse.json({ data: result.rows[0] ?? null }, { headers: { "Cache-Control": "no-store" } });
  }
  if (kind === "subscription-entitlements") {
    const userId = url.searchParams.get("userId");
    const planId = url.searchParams.get("planId");
    if (!userId || !planId) return NextResponse.json({ error: "userId and planId are required" }, { status: 400 });
    const subscription = await databasePool.query(
      `select id,user_id,plan_id,provider,status,current_period_start,current_period_end from public.subscriptions where user_id=$1 and plan_id=$2 and status='active' order by current_period_end desc limit 1`,
      [userId, planId],
    );
    const row = subscription.rows[0] ?? null;
    const entitlements = row ? await databasePool.query(
      `select benefit_code,status,starts_at,ends_at,source_type,source_id from public.entitlements where user_id=$1 and source_type='subscription' and source_id=$2 order by benefit_code`,
      [userId, row.id],
    ) : { rows: [] };
    return NextResponse.json({ data: { subscription: row, entitlements: entitlements.rows } }, { headers: { "Cache-Control": "no-store" } });
  }
  if (kind === "audit-export") {
    const actorId = url.searchParams.get("actorId");
    const entityId = url.searchParams.get("entityId") ?? "payments";
    if (!actorId) return NextResponse.json({ error: "actorId is required" }, { status: 400 });
    const result = await databasePool.query(
      `select actor_id,action,entity_id,metadata,created_at from public.audit_logs where actor_id=$1 and action='premium_report_exported' and entity_id=$2 order by created_at desc limit 1`,
      [actorId, entityId],
    );
    return NextResponse.json({ data: result.rows[0] ?? null }, { headers: { "Cache-Control": "no-store" } });
  }
  return NextResponse.json({ error: "Unsupported QA state kind." }, { status: 400 });
}

export async function POST(request: Request) {
  if (!stagingQaAuthorized(request)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const body = await request.json().catch(() => ({})) as { kind?: string; userId?: string };
  if (body.kind !== "premium-benefit-fixture") return NextResponse.json({ error: "Unsupported QA state mutation." }, { status: 400 });
  if (!body.userId || !uuidPattern.test(body.userId)) return NextResponse.json({ error: "Valid userId is required." }, { status: 400 });

  const client = await databasePool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('request.jwt.claim.role', 'service_role', true)");
    const user = await client.query(`select id from public."user" where id=$1 limit 1`, [body.userId]);
    if (user.rowCount !== 1) throw new Error("QA user does not exist.");

    await clearPremiumFixture(client);
    await client.query(
      `update public.entitlements set status='revoked',ends_at=least(ends_at,now()),updated_at=now() where user_id=$1 and status='active'`,
      [body.userId],
    );
    await client.query(
      `update public.subscriptions set status='expired',current_period_end=least(coalesce(current_period_end,now()),now()),cancel_at_period_end=false,updated_at=now() where user_id=$1 and status in ('active','past_due','cancel_at_period_end')`,
      [body.userId],
    );
    await client.query(`delete from public.user_devices where user_id=$1`, [body.userId]);

    const category = await client.query<{ id: string }>(`select id from public.categories where slug='originals' limit 1`);
    const categoryId = category.rows[0]?.id;
    if (!categoryId) throw new Error("Originals category is unavailable.");

    await client.query(
      `insert into public.content_items
        (id,slug,content_type,hosting_mode,access_level,status,title_en,description_en,primary_category_id,language,audience,sensitivity,is_available,publish_at)
       values
        ($1,$2,'video','self_host_owned','premium','draft','QA Premium Catalogue Title','Staging-only Premium playback entitlement fixture.',$7,'en','general','standard',false,now()-interval '1 hour'),
        ($3,$4,'video','self_host_owned','public','draft','QA Enhanced Quality Title','Staging-only playback quality fixture.',$7,'en','general','standard',false,now()-interval '1 hour'),
        ($5,$6,'article','text_database','public','draft','QA Jalwa Original Early Access','Staging-only future-release Early Access fixture.',$7,'en','general','standard',false,now()+interval '7 days')`,
      [
        premiumFixture.premiumContentId, premiumFixture.premiumSlug,
        premiumFixture.qualityContentId, premiumFixture.qualitySlug,
        premiumFixture.earlyAccessContentId, premiumFixture.earlyAccessSlug,
        categoryId,
      ],
    );

    for (const [id, contentId, source] of [
      ["11111111-1111-4111-8111-111111111401", premiumFixture.premiumContentId, "premium"],
      ["11111111-1111-4111-8111-111111111402", premiumFixture.qualityContentId, "quality"],
      ["11111111-1111-4111-8111-111111111403", premiumFixture.earlyAccessContentId, "early"],
    ] as const) {
      await client.query(
        `insert into public.rights_records
          (id,content_id,source_url,creator,licence_code,attribution_text,jurisdiction_note,
           commercial_use_confirmed,modification_confirmed,self_hosting_confirmed,embedding_confirmed,
           status,verified_at,evidence_note,takedown_contact,rights_hold)
         values($1,$2,$3,'Jalwa QA','jalwa-owned-qa','Jalwa staging QA fixture.','Staging only',
           true,true,true,false,'approved',now(),'Deterministic protected staging QA fixture.','qa@watch-jalwa.com',false)`,
        [id, contentId, `https://watch-jalwa.com/qa/${source}`],
      );
    }

    for (const [assetId, contentId, suffix] of [
      [premiumFixture.premiumAssetId, premiumFixture.premiumContentId, "premium"],
      [premiumFixture.qualityAssetId, premiumFixture.qualityContentId, "quality"],
    ] as const) {
      const storageKey = `processed/${contentId}/${assetId}/master.m3u8`;
      await client.query(
        `insert into public.media_assets
          (id,content_id,kind,status,storage_key,mime_type,metadata,is_available)
         values($1,$2,'hls_manifest','ready',$3,'application/vnd.apple.mpegurl','{"qa_fixture":true}'::jsonb,true)`,
        [assetId, contentId, storageKey],
      );
      await client.query(
        `insert into public.playback_sources
          (content_id,provider,provider_content_id,media_url,is_primary,status,media_asset_id,format,is_available)
         values($1,'original',$2,$3,true,'active',$4,'hls',true)`,
        [contentId, `qa-premium-${suffix}`, storageKey, assetId],
      );
    }

    await client.query(
      `update public.content_items set status='published',is_available=true where id=any($1::uuid[])`,
      [[premiumFixture.premiumContentId, premiumFixture.qualityContentId, premiumFixture.earlyAccessContentId]],
    );

    await client.query(
      `insert into public.collections(id,slug,title_en,description_en,access_level,status,publish_at)
       values($1,$2,'QA Premium Collection','Staging-only Premium Collections entitlement fixture.','premium','published',now())
       on conflict(id) do update set slug=excluded.slug,title_en=excluded.title_en,description_en=excluded.description_en,access_level='premium',status='published',publish_at=excluded.publish_at`,
      [premiumFixture.premiumCollectionId, premiumFixture.premiumCollectionSlug],
    );
    await client.query(
      `insert into public.collection_items(collection_id,content_id,sort_order)
       values($1,$2,10),($1,$3,20)
       on conflict(collection_id,content_id) do update set sort_order=excluded.sort_order`,
      [premiumFixture.premiumCollectionId, premiumFixture.qualityContentId, premiumFixture.earlyAccessContentId],
    );

    await client.query("commit");
    return NextResponse.json({ data: premiumFixture }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    console.error("premium_benefit_fixture_setup_failed", error);
    return NextResponse.json({ error: "Premium QA fixture could not be prepared." }, { status: 500 });
  } finally {
    client.release();
  }
}

export async function DELETE(request: Request) {
  if (!stagingQaAuthorized(request)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const body = await request.json().catch(() => ({})) as { kind?: string };
  if (body.kind !== "premium-benefit-fixture") return NextResponse.json({ error: "Unsupported QA state mutation." }, { status: 400 });
  const client = await databasePool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('request.jwt.claim.role', 'service_role', true)");
    await clearPremiumFixture(client);
    await client.query("commit");
    return NextResponse.json({ ok: true }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    await client.query("rollback").catch(() => undefined);
    console.error("premium_benefit_fixture_cleanup_failed", error);
    return NextResponse.json({ error: "Premium QA fixture cleanup failed." }, { status: 500 });
  } finally {
    client.release();
  }
}
