/**
 * Staging-only: set password Abc@123 on every Better Auth user credential.
 * Uses the same scrypt hash format as apps/web/lib/auth/password-hash.mjs.
 */
import { randomBytes, randomUUID, scrypt } from "node:crypto";
import { promisify } from "node:util";
import pg from "pg";

const scryptAsync = promisify(scrypt);
const SCRYPT = { N: 16384, r: 16, p: 1, maxmem: 128 * 16384 * 16 * 2 };
const DEFAULT_PASSWORD = process.env.STAGING_DEFAULT_LEARNER_PASSWORD || "Abc@123";

async function hashPassword(password) {
  const salt = randomBytes(16).toString("hex");
  const key = await scryptAsync(String(password).normalize("NFKC"), salt, 64, SCRYPT);
  return `${salt}:${Buffer.from(key).toString("hex")}`;
}

async function main() {
  if (process.env.DEPLOYMENT_ENVIRONMENT && process.env.DEPLOYMENT_ENVIRONMENT !== "staging") {
    throw new Error("refusing to run outside staging");
  }
  const databaseUrl = process.env.DATABASE_URL?.trim();
  if (!databaseUrl) throw new Error("DATABASE_URL is required");

  const pool = new pg.Pool({ connectionString: databaseUrl, max: 2 });
  try {
    const hash = await hashPassword(DEFAULT_PASSWORD);
    const users = await pool.query(`select id from public."user"`);
    let updated = 0;
    let inserted = 0;
    for (const user of users.rows) {
      const existing = await pool.query(
        `select id from public."account" where "userId" = $1 and "providerId" = 'credential' order by "createdAt" asc limit 1`,
        [user.id],
      );
      if (existing.rows[0]) {
        await pool.query(
          `update public."account"
           set password = $2, "accountId" = $3, "updatedAt" = now()
           where id = $1`,
          [existing.rows[0].id, hash, user.id],
        );
        updated += 1;
      } else {
        await pool.query(
          `insert into public."account" (id, "accountId", "providerId", "userId", password, "createdAt", "updatedAt")
           values ($1, $2, 'credential', $3, $4, now(), now())`,
          [randomUUID(), user.id, user.id, hash],
        );
        inserted += 1;
      }
    }
    console.log(JSON.stringify({
      scope: "staging_only",
      users: users.rows.length,
      updated,
      inserted,
      password: DEFAULT_PASSWORD,
    }));
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
