/**
 * Drizzle ORM client for ShiftSwap.
 *
 * Uses the @neondatabase/serverless Pool (same as db.ts) but wraps it with
 * Drizzle for type-safe query building. Both the raw `query()` helpers in
 * db.ts and this Drizzle client can coexist — use whichever fits the task.
 */
import { drizzle } from 'drizzle-orm/neon-serverless';
import { Pool } from '@neondatabase/serverless';
import * as schema from './schema';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL environment variable is not set');
    }
    pool = new Pool({
      connectionString,
      max: 10,
      idleTimeoutMillis: 20_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

/**
 * Drizzle database instance with full schema for type-safe queries.
 *
 * Usage:
 * ```ts
 * import { db } from '@/lib/drizzle';
 * import { shifts } from '@/lib/schema';
 * import { eq } from 'drizzle-orm';
 *
 * const allShifts = await db.select().from(shifts).where(eq(shifts.orgId, orgId));
 * ```
 */
export const db = drizzle(getPool(), { schema });
