/**
 * Boot a local Docker Postgres for Jalwa auth/profile testing.
 * Usage: node --env-file=apps/web/.env.local scripts/local-dev-db.mjs
 */
import { createHash, randomBytes, randomUUID, scrypt } from "node:crypto";
import { createReadStream, existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { promisify } from "node:util";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const scryptAsync = promisify(scrypt);
const SCRYPT = { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 };
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const CONTAINER = "jalwa-local-postgres";
const HOST_PORT = process.env.LOCAL_POSTGRES_PORT || "5434";
const IMAGE = process.env.LOCAL_POSTGRES_IMAGE || "pgvector/pgvector:pg17";
const ENV_LOCAL = resolve(ROOT, "apps/web/.env.local");
const BOOTSTRAP = resolve(ROOT, "scripts/ci-bootstrap-postgres.sql");
const MIGRATIONS_DIR = resolve(ROOT, "database/migrations");

function docker(args, opts = {}) {
  const result = spawnSync("docker", args, {
    encoding: "utf8",
    stdio: opts.stdio || ["ignore", "pipe", "pipe"],
    ...opts,
  });
  if (result.status !== 0) {
    throw new Error(`docker ${args.join(" ")} failed: ${result.stderr || result.stdout || result.status}`);
  }
  return result.stdout || "";
}

function parseDatabaseUrl(raw) {
  const url = new URL(raw);
  return {
    url,
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password),
    database: url.pathname.replace(/^\//, "") || "jalwa_staging",
  };
}

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scryptAsync(String(password).normalize("NFKC"), salt, 64, SCRYPT);
  return `${salt}:${Buffer.from(key).toString("hex")}`;
}

function waitForReady(user, database) {
  for (let i = 0; i < 40; i += 1) {
    const result = spawnSync(
      "docker",
      ["exec", CONTAINER, "pg_isready", "-U", user, "-d", database],
      { encoding: "utf8" },
    );
    if (result.status === 0) return;
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 500);
  }
  throw new Error("Postgres did not become ready");
}

function applySqlFile(user, database, filePath) {
  const result = spawnSync(
    "docker",
    ["exec", "-i", CONTAINER, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", user, "-d", database],
    {
      encoding: "utf8",
      input: readFileSync(filePath),
      maxBuffer: 20 * 1024 * 1024,
    },
  );
  if (result.status !== 0) {
    throw new Error(`SQL failed (${filePath}): ${result.stderr || result.stdout}`);
  }
}

function ensureContainer({ user, password, database }) {
  const existing = spawnSync("docker", ["inspect", CONTAINER], { encoding: "utf8" });
  if (existing.status === 0) {
    docker(["rm", "-f", CONTAINER]);
  }
  docker([
    "run",
    "-d",
    "--name",
    CONTAINER,
    "-e",
    `POSTGRES_USER=${user}`,
    "-e",
    `POSTGRES_PASSWORD=${password}`,
    "-e",
    `POSTGRES_DB=${database}`,
    "-p",
    `127.0.0.1:${HOST_PORT}:5432`,
    IMAGE,
  ]);
  waitForReady(user, database);
}

function updateEnvLocal(nextUrl) {
  if (!existsSync(ENV_LOCAL)) throw new Error(`Missing ${ENV_LOCAL}`);
  const original = readFileSync(ENV_LOCAL, "utf8");
  let next = original;
  if (/^DATABASE_URL=/m.test(original)) {
    next = original.replace(/^DATABASE_URL=.*$/m, `DATABASE_URL=${nextUrl}`);
  } else {
    next = `${original.trimEnd()}\nDATABASE_URL=${nextUrl}\n`;
  }
  if (!/^DEPLOYMENT_ENVIRONMENT=/m.test(next)) {
    next += `\nDEPLOYMENT_ENVIRONMENT=local\n`;
  } else {
    next = next.replace(/^DEPLOYMENT_ENVIRONMENT=.*$/m, "DEPLOYMENT_ENVIRONMENT=local");
  }
  writeFileSync(ENV_LOCAL, next.endsWith("\n") ? next : `${next}\n`, "utf8");
}

async function applyMigrations(user, database) {
  applySqlFile(user, database, BOOTSTRAP);
  const tracking = spawnSync(
    "docker",
    ["exec", "-i", CONTAINER, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", user, "-d", database],
    {
      encoding: "utf8",
      input: `create table if not exists public.jalwa_schema_migrations (
  filename text primary key,
  checksum text not null,
  status text not null default 'applied' check (status in ('applying','applied','failed')),
  started_at timestamptz not null default now(),
  applied_at timestamptz,
  error_message text
);`,
    },
  );
  if (tracking.status !== 0) throw new Error(tracking.stderr || tracking.stdout);

  const files = readdirSync(MIGRATIONS_DIR)
    .filter((name) => /^\d{12,}_[a-z0-9_]+\.sql$/i.test(name))
    .sort();

  for (const filename of files) {
    const full = resolve(MIGRATIONS_DIR, filename);
    const checksum = createHash("sha256").update(readFileSync(full)).digest("hex");
    const existing = spawnSync(
      "docker",
      ["exec", "-i", CONTAINER, "psql", "-X", "-At", "-U", user, "-d", database, "-v", `filename=${filename}`],
      {
        encoding: "utf8",
        input: "select status from public.jalwa_schema_migrations where filename = :'filename';",
      },
    );
    if ((existing.stdout || "").trim() === "applied") {
      console.log(`SKIP ${filename}`);
      continue;
    }
    console.log(`APPLY ${filename}`);
    const mark = spawnSync(
      "docker",
      ["exec", "-i", CONTAINER, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", user, "-d", database,
        "-v", `filename=${filename}`, "-v", `checksum=${checksum}`],
      {
        encoding: "utf8",
        input: `insert into public.jalwa_schema_migrations(filename,checksum,status,started_at,applied_at,error_message)
values (:'filename',:'checksum','applying',now(),null,null)
on conflict (filename) do update set checksum=excluded.checksum,status='applying',started_at=now(),applied_at=null,error_message=null;`,
      },
    );
    if (mark.status !== 0) throw new Error(mark.stderr || mark.stdout);

    try {
      applySqlFile(user, database, full);
      const done = spawnSync(
        "docker",
        ["exec", "-i", CONTAINER, "psql", "-X", "-v", "ON_ERROR_STOP=1", "-U", user, "-d", database,
          "-v", `filename=${filename}`, "-v", `checksum=${checksum}`],
        {
          encoding: "utf8",
          input: `update public.jalwa_schema_migrations
set status='applied', checksum=:'checksum', applied_at=now(), error_message=null
where filename=:'filename';`,
        },
      );
      if (done.status !== 0) throw new Error(done.stderr || done.stdout);
    } catch (error) {
      spawnSync(
        "docker",
        ["exec", "-i", CONTAINER, "psql", "-X", "-U", user, "-d", database, "-v", `filename=${filename}`],
        {
          encoding: "utf8",
          input: `update public.jalwa_schema_migrations
set status='failed', error_message='psql execution failed', applied_at=null
where filename=:'filename';`,
        },
      );
      throw error;
    }
  }
}

async function seedTestLearner(databaseUrl) {
  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  const phone = "+923123456789";
  const email = "923123456789@msisdn.jalwa.local";
  const password = "Abc@123";
  const displayName = "Local Test";
  try {
    const hash = await hashPassword(password);
    let userId;
    const existing = await pool.query(
      `select id from public."user" where "phoneNumber" = $1 or lower(email) = lower($2) limit 1`,
      [phone, email],
    );
    if (existing.rows[0]) {
      userId = existing.rows[0].id;
      await pool.query(
        `update public."user"
         set name = $2, "phoneNumber" = $3, "phoneNumberVerified" = true, "updatedAt" = now()
         where id = $1`,
        [userId, displayName, phone],
      );
    } else {
      userId = randomUUID();
      await pool.query(
        `insert into public."user" (id, name, email, "emailVerified", "phoneNumber", "phoneNumberVerified", "createdAt", "updatedAt")
         values ($1, $2, $3, false, $4, true, now(), now())`,
        [userId, displayName, email, phone],
      );
    }

    await pool.query(
      `insert into public.profiles (id, display_name, preferred_language)
       values ($1, $2, 'en')
       on conflict (id) do update set display_name = excluded.display_name, updated_at = now()`,
      [userId, displayName],
    );

    const account = await pool.query(
      `select id from public."account" where "userId" = $1 and "providerId" = 'credential' limit 1`,
      [userId],
    );
    // Better Auth 1.7 credential rows use issuer "local:credential".
    await pool.query(`alter table public."account" add column if not exists issuer text`);
    if (account.rows[0]) {
      await pool.query(
        `update public."account"
         set password = $2, "accountId" = $3, issuer = 'local:credential', "updatedAt" = now()
         where id = $1`,
        [account.rows[0].id, hash, userId],
      );
    } else {
      await pool.query(
        `insert into public."account" (id, "accountId", "providerId", "userId", password, issuer, "createdAt", "updatedAt")
         values ($1, $2, 'credential', $3, $4, 'local:credential', now(), now())`,
        [randomUUID(), userId, userId, hash],
      );
    }

    const plan = await pool.query(
      `select p.id as plan_id, pr.id as price_id, pr.code as price_code, pr.currency, pr.amount_minor, pr.billing_period, pr.duration_days, p.benefits
       from public.plans p
       join public.prices pr on pr.plan_id = p.id
       where p.code in ('premium', 'premium-monthly-pkr') or pr.code ilike '%monthly%'
       order by case when pr.code ilike '%monthly%' then 0 else 1 end
       limit 1`,
    );
    if (!plan.rows[0]) {
      return { userId, phone: "03123456789", password, premium: false, reason: "no_plan" };
    }

    await pool.query(
      `update public.subscriptions
       set status = 'cancelled', cancel_at_period_end = false, auto_renew_consented = false,
           current_period_end = least(coalesce(current_period_end, now()), now()),
           cancelled_at = coalesce(cancelled_at, now()), updated_at = now()
       where user_id = $1 and status in ('active','past_due','cancel_at_period_end','incomplete')`,
      [userId],
    );
    await pool.query(
      `update public.entitlements
       set status = 'revoked', ends_at = least(ends_at, now()), updated_at = now()
       where user_id = $1 and status = 'active'`,
      [userId],
    );

    const endsAt = new Date(Date.now() + Number(plan.rows[0].duration_days || 30) * 86400000).toISOString();
    const sub = await pool.query(
      `insert into public.subscriptions(
         user_id, plan_id, provider, provider_subscription_id, status,
         current_period_start, current_period_end, cancel_at_period_end,
         auto_renew_consented, auto_renew_consented_at, price_snapshot, activation_source, activated_at
       ) values (
         $1, $2, 'mock', $3, 'active',
         now(), $4::timestamptz, false,
         true, now(),
         jsonb_build_object('code', $5::text, 'currency', $6::text, 'amountMinor', $7::bigint, 'billingPeriod', $8::text),
         'paid', now()
       ) returning id::text as id`,
      [
        userId,
        plan.rows[0].plan_id,
        `local-${Date.now()}`,
        endsAt,
        plan.rows[0].price_code,
        plan.rows[0].currency,
        Number(plan.rows[0].amount_minor),
        plan.rows[0].billing_period,
      ],
    );

    await pool.query(
      `insert into public.entitlements(user_id, benefit_code, starts_at, ends_at, source_type, source_id, status)
       values ($1, 'premium_catalogue', now(), $2::timestamptz, 'subscription', $3::uuid, 'active')
       on conflict (user_id, benefit_code, source_type, source_id)
       do update set starts_at = excluded.starts_at, ends_at = excluded.ends_at, status = 'active', updated_at = now()`,
      [userId, endsAt, sub.rows[0].id],
    );

    return { userId, phone: "03123456789", password, premium: true, subscriptionId: sub.rows[0].id };
  } finally {
    await pool.end();
  }
}

async function main() {
  const raw = process.env.DATABASE_URL?.trim();
  if (!raw) throw new Error("DATABASE_URL missing. Run with --env-file=apps/web/.env.local");
  const parsed = parseDatabaseUrl(raw);
  console.log(`Starting ${CONTAINER} on 127.0.0.1:${HOST_PORT} db=${parsed.database} user=${parsed.user}`);
  ensureContainer({
    user: parsed.user,
    password: parsed.password,
    database: parsed.database,
  });
  await applyMigrations(parsed.user, parsed.database);

  const localUrl = new URL(raw);
  localUrl.hostname = "127.0.0.1";
  localUrl.port = HOST_PORT;
  updateEnvLocal(localUrl.toString());

  const seed = await seedTestLearner(localUrl.toString());
  console.log(JSON.stringify({
    ok: true,
    container: CONTAINER,
    databaseUrlHost: `127.0.0.1:${HOST_PORT}`,
    database: parsed.database,
    user: parsed.user,
    seed,
    next: "Restart npm run dev, then login with 03123456789 / Abc@123",
  }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
