import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { databasePool } from "@/lib/database/pool";
import { qaEmailAllowed, safeQaNextPath, stagingQaAuthorized } from "../_guard";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const allowedRoles = new Set(["subscriber", "editor", "admin", "rights_reviewer", "finance", "viewer"]);

export async function POST(request: Request) {
  if (!stagingQaAuthorized(request)) return NextResponse.json({ error: "Not found." }, { status: 404 });
  const body = await request.json().catch(() => ({})) as { email?: string; role?: string; nextPath?: string; issueLink?: boolean; qaRunId?: string };
  const email = body.email?.trim().toLowerCase() ?? "";
  if (!/^\S+@\S+\.\S+$/.test(email) || !qaEmailAllowed(email)) return NextResponse.json({ error: "QA identity is not allowlisted." }, { status: 403 });
  const role = body.role?.trim() || null;
  if (role && !allowedRoles.has(role)) return NextResponse.json({ error: "Invalid QA role." }, { status: 400 });

  const existing = await databasePool.query<{ id: string }>(`select id from public."user" where lower(email)=lower($1) limit 1`, [email]);
  let userId = existing.rows[0]?.id ?? null;
  if (!userId) {
    const created = await databasePool.query<{ id: string }>(
      `insert into public."user" (name,email,"emailVerified") values ($1,$2,true) returning id`,
      [email.split("@")[0] || "QA User", email],
    );
    userId = created.rows[0]?.id ?? null;
  } else {
    await databasePool.query(`update public."user" set "emailVerified"=true,"updatedAt"=now() where id=$1`, [userId]);
  }
  if (!userId) return NextResponse.json({ error: "QA identity could not be created." }, { status: 500 });

  if (role) {
    await databasePool.query(`update public.profiles set role=$2,onboarding_completed=true,updated_at=now() where id=$1`, [userId, role]);
  }

  if (body.issueLink === false) return NextResponse.json({ user: { id: userId, email } }, { headers: { "Cache-Control": "no-store" } });

  const qaRunId = (body.qaRunId?.trim() || crypto.randomUUID()).slice(0, 160);
  const callbackURL = safeQaNextPath(body.nextPath);
  await databasePool.query(`delete from public.qa_magic_links where email=$1 and qa_run_id=$2`, [email, qaRunId]);
  await auth.api.signInMagicLink({
    body: { email, callbackURL, metadata: { qaSecret: process.env.STAGING_QA_SECRET, qaRunId } },
  });
  const link = await databasePool.query<{ url: string }>(
    `select url from public.qa_magic_links where email=$1 and qa_run_id=$2 and expires_at>now() order by created_at desc limit 1`,
    [email, qaRunId],
  );
  const actionLink = link.rows[0]?.url;
  if (!actionLink || !/^https?:\/\//.test(actionLink)) return NextResponse.json({ error: "QA magic link was not produced." }, { status: 500 });
  return NextResponse.json({ user: { id: userId, email }, actionLink }, { headers: { "Cache-Control": "no-store" } });
}
