import type { Pool, PoolConfig, QueryResult } from "pg";
export type DbError = Error & { code?: string };
export type DbResult<T = any> = { data: T; error: DbError | null; count?: number | null };
export type AuthUser = { id: string; email?: string | null; [key: string]: any };
export type AuthFacade = {
  getUser(): Promise<{ data: { user: AuthUser | null }; error: DbError | null }>;
  signOut(): Promise<{ error: DbError | null }>;
  admin?: { getUserById(id: string): Promise<any>; deleteUser(id: string): Promise<any> };
};
export class DatabaseClient {
  constructor(pool: Pool, options?: { userId?: string | null; role?: string; auth?: AuthFacade });
  auth: AuthFacade;
  from(table: string): any;
  rpc(name: string, args?: Record<string, unknown>): Promise<DbResult<any>>;
  query<T = any>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
}
export function createPool(connectionString: string, options?: PoolConfig): Pool;
export function createDatabaseClient(pool: Pool, options?: { userId?: string | null; role?: string; auth?: AuthFacade }): DatabaseClient;
