import type { Pool, PoolConfig, QueryResult, QueryResultRow } from "pg";

export type DbError = Error & { code?: string };
export type DbResult<T = unknown> = { data: T; error: DbError | null; count?: number | null };
export type DatabaseRow = Record<string, any>;
export type AuthUser = { id: string; email?: string | null; phone?: string | null; [key: string]: any };
export type AuthAdminFacade = {
  getUserById(id: string): Promise<any>;
  deleteUser(id: string): Promise<any>;
};
export type AuthFacade = {
  getUser(): Promise<{ data: { user: AuthUser | null }; error: DbError | null }>;
  signOut(): Promise<{ error: DbError | null }>;
  admin?: AuthAdminFacade;
};

type Cardinality = "many" | "single" | "maybeSingle";
type QueryData<T, C extends Cardinality> = C extends "many" ? T[] : C extends "single" ? T : T | null;

export class QueryBuilder<T extends DatabaseRow = any, C extends Cardinality = "many"> implements PromiseLike<DbResult<QueryData<T, C>>> {
  select(columns?: string, options?: { count?: "exact" | string; head?: boolean }): QueryBuilder<T, C>;
  insert(values: DatabaseRow | DatabaseRow[]): QueryBuilder<T, C>;
  update(values: DatabaseRow): QueryBuilder<T, C>;
  upsert(values: DatabaseRow | DatabaseRow[], options?: { onConflict?: string; ignoreDuplicates?: boolean }): QueryBuilder<T, C>;
  delete(): QueryBuilder<T, C>;
  eq(column: string, value: unknown): QueryBuilder<T, C>;
  neq(column: string, value: unknown): QueryBuilder<T, C>;
  gt(column: string, value: unknown): QueryBuilder<T, C>;
  gte(column: string, value: unknown): QueryBuilder<T, C>;
  lt(column: string, value: unknown): QueryBuilder<T, C>;
  lte(column: string, value: unknown): QueryBuilder<T, C>;
  like(column: string, value: unknown): QueryBuilder<T, C>;
  ilike(column: string, value: unknown): QueryBuilder<T, C>;
  in(column: string, values: unknown[]): QueryBuilder<T, C>;
  is(column: string, value: unknown): QueryBuilder<T, C>;
  not(column: string, operator: string, value: unknown): QueryBuilder<T, C>;
  contains(column: string, value: unknown): QueryBuilder<T, C>;
  match(values: Record<string, unknown>): QueryBuilder<T, C>;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder<T, C>;
  limit(value: number): QueryBuilder<T, C>;
  range(from: number, to: number): QueryBuilder<T, C>;
  single(): QueryBuilder<T, "single">;
  maybeSingle(): QueryBuilder<T, "maybeSingle">;
  then<TResult1 = DbResult<QueryData<T, C>>, TResult2 = never>(
    onfulfilled?: ((value: DbResult<QueryData<T, C>>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
}

export class DatabaseClient {
  constructor(pool: Pool, options?: { userId?: string | null; role?: string; auth?: AuthFacade });
  auth: AuthFacade;
  from<T extends DatabaseRow = any>(table: string): QueryBuilder<T>;
  rpc(name: string, args?: Record<string, unknown>): Promise<DbResult<any>>;
  query<T extends QueryResultRow = DatabaseRow>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
}

export type AdminDatabaseClient = DatabaseClient & { auth: AuthFacade & { admin: AuthAdminFacade } };

export function createPool(connectionString: string, options?: PoolConfig): Pool;
export function createDatabaseClient(pool: Pool, options?: { userId?: string | null; role?: string; auth?: AuthFacade }): DatabaseClient;
