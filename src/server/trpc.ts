/**
 * tRPC server initialization and middleware definitions.
 *
 * This module sets up:
 * - tRPC context creation (with Neon Auth + DB client)
 * - Auth middleware (verifies Neon Auth session)
 * - Org context middleware (derives org_id, sets RLS session vars)
 */
import { initTRPC, TRPCError } from '@trpc/server';
import { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import superjson from 'superjson';
import { OrgRole } from '@/types/database';
import { getOrgContext } from '@/lib/orgContext';
import { getAuthUser } from '@/lib/auth';
import { createDbClient, DbClient } from '@/lib/db-client';

/**
 * Context available to all tRPC procedures.
 */
export interface Context {
  db: DbClient;
  user: { id: string; email: string } | null;
}

/**
 * Extended context after org middleware runs.
 */
export interface AuthedOrgContext extends Context {
  user: { id: string; email: string };
  orgId: string;
  orgRole: OrgRole;
}

/**
 * Creates the tRPC context for each request.
 * Initializes a DB client and extracts user from Neon Auth session.
 */
export async function createTRPCContext(
  _opts: FetchCreateContextFnOptions
): Promise<Context> {
  const db = createDbClient();
  const user = await getAuthUser();

  return { db, user };
}

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;
export const createCallerFactory = t.createCallerFactory;

/**
 * Auth middleware — ensures user is authenticated.
 * Adds typed user to context.
 */
const isAuthed = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
    },
  });
});

/**
 * Org context middleware — derives org_id from user's membership,
 * sets the PostgreSQL RLS session variable, and adds orgId/orgRole to context.
 *
 * Pattern: set_config('app.current_org_id', orgId, true) scoped to the transaction.
 */
const withOrgContext = t.middleware(async ({ ctx, next }) => {
  if (!ctx.user) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in to access this resource',
    });
  }

  // Derive org context from user's membership
  const orgCtx = await getOrgContext(ctx.db, ctx.user.id);

  // Set PostgreSQL session variable for RLS enforcement
  const { error } = await ctx.db.rpc('set_org_context', {
    org_id: orgCtx.orgId,
  });

  if (error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to set org context: ${error.message}`,
    });
  }

  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      orgId: orgCtx.orgId,
      orgRole: orgCtx.role,
    },
  });
});

/**
 * Procedure that requires authentication only (no org context).
 * Use for auth-related routes like listing user's orgs.
 */
export const authedProcedure = t.procedure.use(isAuthed);

/**
 * Procedure that requires authentication AND org context.
 * Sets RLS session vars so all subsequent queries are org-scoped.
 * Use for all org-scoped operations (shifts, callouts, claims, etc.).
 */
export const orgProcedure = t.procedure.use(withOrgContext);
