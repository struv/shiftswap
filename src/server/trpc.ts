/**
 * tRPC server initialization and middleware definitions.
 *
 * This module sets up:
 * - tRPC context creation (with Supabase client)
 * - Auth middleware (verifies Supabase session)
 * - Org context middleware (derives org_id, sets RLS session vars)
 */
import { initTRPC, TRPCError } from '@trpc/server';
import { FetchCreateContextFnOptions } from '@trpc/server/adapters/fetch';
import { SupabaseClient } from '@supabase/supabase-js';
import superjson from 'superjson';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { OrgRole } from '@/types/database';
import { getOrgContext } from '@/lib/orgContext';

/**
 * Context available to all tRPC procedures.
 */
export interface Context {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: SupabaseClient<any>;
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
 * Initializes a Supabase server client and extracts user from session.
 */
export async function createTRPCContext(
  _opts: FetchCreateContextFnOptions
): Promise<Context> {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Missing Supabase environment variables',
    });
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from Server Component — ignored when middleware refreshes sessions
        }
      },
    },
  });

  // Get authenticated user (if any)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return {
    supabase,
    user: user ? { id: user.id, email: user.email! } : null,
  };
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
  const orgCtx = await getOrgContext(ctx.supabase, ctx.user.id);

  // Set PostgreSQL session variable for RLS enforcement
  const { error } = await ctx.supabase.rpc('set_org_context', {
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
 * Sets RLS session vars so all subsequent Supabase queries are org-scoped.
 * Use for all org-scoped operations (shifts, callouts, claims, etc.).
 */
export const orgProcedure = t.procedure.use(withOrgContext);
