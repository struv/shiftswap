import { Pool, type PoolClient, type QueryResult, type QueryResultRow } from '@neondatabase/serverless';

// ---------------------------------------------------------------------------
// Pool – lazy singleton, created on first use
// ---------------------------------------------------------------------------

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    pool = new Pool({
      connectionString,
      // Sensible defaults for serverless – short-lived functions should not
      // hold many idle connections open.
      max: 10,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

/**
 * End the connection pool. Call this during graceful shutdown if needed.
 */
export async function endPool(): Promise<void> {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

// ---------------------------------------------------------------------------
// Low-level query helper
// ---------------------------------------------------------------------------

/**
 * Run a parameterised query against the pool.
 *
 * ```ts
 * const { rows } = await query<User>('SELECT * FROM users WHERE id = $1', [id]);
 * ```
 */
export async function query<T extends QueryResultRow = QueryResultRow>(
  text: string,
  values?: unknown[],
): Promise<QueryResult<T>> {
  return getPool().query<T>(text, values);
}

// ---------------------------------------------------------------------------
// Org-context helper
// ---------------------------------------------------------------------------

/**
 * Acquire a connection, set the `app.current_org_id` session variable for
 * Row-Level Security, run the callback, then release the connection.
 *
 * Every query executed via the supplied `client` will be scoped to `orgId`
 * by the RLS policies in the database.
 *
 * ```ts
 * const shifts = await withOrgContext(orgId, async (client) => {
 *   const { rows } = await client.query('SELECT * FROM shifts');
 *   return rows;
 * });
 * ```
 */
export async function withOrgContext<T>(
  orgId: string,
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("SELECT set_config('app.current_org_id', $1, false)", [orgId]);
    return await callback(client);
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Transaction helper
// ---------------------------------------------------------------------------

/**
 * Run `callback` inside a database transaction (BEGIN / COMMIT / ROLLBACK).
 *
 * ```ts
 * await transaction(async (client) => {
 *   await client.query('INSERT INTO shifts …');
 *   await client.query('INSERT INTO audit_logs …');
 * });
 * ```
 */
export async function transaction<T>(
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// ---------------------------------------------------------------------------
// Combined: org-context + transaction
// ---------------------------------------------------------------------------

/**
 * Convenience wrapper that sets the org context **and** wraps everything in a
 * transaction. This is the most common pattern for mutation endpoints.
 *
 * ```ts
 * await withOrgTransaction(orgId, async (client) => {
 *   await client.query('UPDATE shifts SET …');
 *   await client.query('INSERT INTO audit_logs …');
 * });
 * ```
 */
export async function withOrgTransaction<T>(
  orgId: string,
  callback: (client: PoolClient) => Promise<T>,
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    await client.query("SELECT set_config('app.current_org_id', $1, true)", [orgId]);
    const result = await callback(client);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

// Re-export Pool types that callers might need
export type { PoolClient, QueryResult, QueryResultRow };
