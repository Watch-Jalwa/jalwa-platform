import { Pool } from "pg";

const globalForDatabase = globalThis as typeof globalThis & { __jalwaPgPool?: Pool };

function sslOptions() {
  if (process.env.DATABASE_SSL !== "true") return undefined;
  return { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" };
}

export const databasePool = globalForDatabase.__jalwaPgPool ?? new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.POSTGRES_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  application_name: "jalwa-web",
  ssl: sslOptions(),
});

if (process.env.NODE_ENV !== "production") globalForDatabase.__jalwaPgPool = databasePool;
