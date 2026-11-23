import { Pool } from "pg";

const globalForDatabase = globalThis as typeof globalThis & { __jalwaPgPool?: Pool };

function sslOptions() {
  if (process.env.DATABASE_SSL !== "true") return undefined;
  return { rejectUnauthorized: process.env.DATABASE_SSL_REJECT_UNAUTHORIZED !== "false" };
}

/** Docker Compose uses hostname `postgres`; map to localhost for host-side `next dev`. */
function resolveDatabaseUrl() {
  const raw = process.env.DATABASE_URL?.trim() ?? "";
  if (!raw) return raw;
  const localish = process.env.DEPLOYMENT_ENVIRONMENT === "local" || process.env.NODE_ENV === "development";
  if (!localish) return raw;
  try {
    const url = new URL(raw);
    if (url.hostname === "postgres") {
      url.hostname = process.env.POSTGRES_HOST?.trim() || "127.0.0.1";
      return url.toString();
    }
  } catch {
    // keep original
  }
  return raw;
}

export const databasePool = globalForDatabase.__jalwaPgPool ?? new Pool({
  connectionString: resolveDatabaseUrl(),
  max: Number(process.env.POSTGRES_POOL_MAX ?? 10),
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: Number(process.env.POSTGRES_CONNECT_TIMEOUT_MS ?? (process.env.NODE_ENV === "development" ? 2_000 : 10_000)),
  application_name: "jalwa-web",
  ssl: sslOptions(),
});

if (process.env.NODE_ENV !== "production") globalForDatabase.__jalwaPgPool = databasePool;
