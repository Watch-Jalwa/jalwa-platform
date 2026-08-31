import { NextResponse } from "next/server";
import { databasePool } from "@/lib/database/pool";
import { stagingQaAuthorized } from "../_guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

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
