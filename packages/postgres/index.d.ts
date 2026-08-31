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
type QueryData<C extends Cardinality> = C extends "many" ? DatabaseRow[] : C extends "single" ? DatabaseRow : DatabaseRow | null;

export class QueryBuilder<C extends Cardinality = "many"> implements PromiseLike<DbResult<QueryData<C>>> {
  select(columns?: string, options?: { count?: "exact" | string; head?: boolean }): QueryBuilder<C>;
  insert(values: DatabaseRow | DatabaseRow[]): QueryBuilder<C>;
  update(values: DatabaseRow): QueryBuilder<C>;
  upsert(values: DatabaseRow | DatabaseRow[], options?: { onConflict?: string }): QueryBuilder<C>;
  delete(): QueryBuilder<C>;
  eq(column: string, value: unknown): QueryBuilder<C>;
  neq(column: string, value: unknown): QueryBuilder<C>;
  gt(column: string, value: unknown): QueryBuilder<C>;
  gte(column: string, value: unknown): QueryBuilder<C>;
  lt(column: string, value: unknown): QueryBuilder<C>;
  lte(column: string, value: unknown): QueryBuilder<C>;
  like(column: string, value: unknown): QueryBuilder<C>;
  ilike(column: string, value: unknown): QueryBuilder<C>;
  in(column: string, values: unknown[]): QueryBuilder<C>;
  is(column: string, value: unknown): QueryBuilder<C>;
  not(column: string, operator: string, value: unknown): QueryBuilder<C>;
  contains(column: string, value: unknown): QueryBuilder<C>;
  match(values: Record<string, unknown>): QueryBuilder<C>;
  order(column: string, options?: { ascending?: boolean }): QueryBuilder<C>;
  limit(value: number): QueryBuilder<C>;
  range(from: number, to: number): QueryBuilder<C>;
  single(): QueryBuilder<"single">;
  maybeSingle(): QueryBuilder<"maybeSingle">;
  then<TResult1 = DbResult<QueryData<C>>, TResult2 = never>(
    onfulfilled?: ((value: DbResult<QueryData<C>>) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2>;
}

export class DatabaseClient {
  constructor(pool: Pool, options?: { userId?: string | null; role?: string; auth?: AuthFacade });
  auth: AuthFacade;
  from(table: string): QueryBuilder;
  rpc(name: string, args?: Record<string, unknown>): Promise<DbResult<any>>;
  query<T extends QueryResultRow = DatabaseRow>(text: string, values?: unknown[]): Promise<QueryResult<T>>;
}

export type AdminDatabaseClient = DatabaseClient & { auth: AuthFacade & { admin: AuthAdminFacade } };

export function createPool(connectionString: string, options?: PoolConfig): Pool;
export function createDatabaseClient(pool: Pool, options?: { userId?: string | null; role?: string; auth?: AuthFacade }): DatabaseClient;
