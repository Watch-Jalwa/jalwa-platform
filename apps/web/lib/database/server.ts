import { headers } from "next/headers";
import { auth } from "@/lib/auth";
import { databasePool } from "@/lib/database/pool";
import { createDatabaseClient } from "@jalwa/postgres";

export async function createClient() {
  const requestHeaders = await headers();
  let session: Awaited<ReturnType<typeof auth.api.getSession>> | null = null;
  try { session = await auth.api.getSession({ headers: requestHeaders }); } catch { session = null; }
  const user = session?.user ?? null;
  return createDatabaseClient(databasePool, {
    userId: user?.id ?? null,
    role: user ? "authenticated" : "anon",
    auth: {
      async getUser() { return { data: { user }, error: null }; },
      async signOut() {
        try { await auth.api.signOut({ headers: requestHeaders }); return { error: null }; }
        catch (error) { return { error: error instanceof Error ? error : new Error(String(error)) }; }
      },
    },
  });
}
