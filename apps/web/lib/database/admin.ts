import { databasePool } from "@/lib/database/pool";
import { createDatabaseClient, type AdminDatabaseClient } from "@jalwa/postgres";

export function createAdminClient(): AdminDatabaseClient {
  return createDatabaseClient(databasePool, {
    role: "service_role",
    auth: {
      async getUser() { return { data: { user: null }, error: null }; },
      async signOut() { return { error: null }; },
      admin: {
        async getUserById(id: string) {
          try {
            const result = await databasePool.query(`select id,email,name,image,"emailVerified" from public."user" where id=$1`, [id]);
            return { data: { user: result.rows[0] ?? null }, error: null };
          } catch (error) { return { data: { user: null }, error }; }
        },
        async deleteUser(id: string) {
          try { await databasePool.query(`delete from public."user" where id=$1`, [id]); return { data: null, error: null }; }
          catch (error) { return { data: null, error }; }
        },
      },
    },
  }) as AdminDatabaseClient;
}
