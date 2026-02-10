/**
 * Root tRPC router.
 *
 * All sub-routers are merged here. The org context middleware is
 * applied via orgProcedure, so all org-scoped queries automatically
 * have app.current_org_id set for RLS enforcement.
 */
import { z } from 'zod';
import { router, publicProcedure, authedProcedure, orgProcedure } from '../trpc';
import { shiftRouter } from './shift';
import { swapRouter } from './swap';

export const appRouter = router({
  /** Health check — public, no auth required */
  health: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  /** Get current authenticated user info */
  me: authedProcedure.query(async ({ ctx }) => {
    const { data: profile } = await ctx.supabase
      .from('users')
      .select('*')
      .eq('id', ctx.user.id)
      .single();

    return { user: profile };
  }),

  /** Organization-scoped routes */
  org: router({
    /** Get the current user's organization */
    get: orgProcedure.query(async ({ ctx }) => {
      const { data: org } = await ctx.supabase
        .from('organizations')
        .select('*')
        .eq('id', ctx.orgId)
        .single();

      return { org, role: ctx.orgRole };
    }),

    /** List members in the current organization */
    members: orgProcedure.query(async ({ ctx }) => {
      const { data: members } = await ctx.supabase
        .from('org_members')
        .select('*, user:users(*)')
        .eq('org_id', ctx.orgId);

      return { members: members ?? [] };
    }),
  }),

  /** Shift CRUD routes (org-scoped) */
  shift: shiftRouter,

  /** Swap request workflow routes (org-scoped) */
  swap: swapRouter,

  /** Callout routes (org-scoped) */
  callout: router({
    list: orgProcedure
      .input(
        z.object({
          status: z
            .enum(['open', 'claimed', 'approved', 'cancelled'])
            .optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        let query = ctx.supabase.from('callouts').select('*, shift:shifts(*)');

        if (input.status) {
          query = query.eq('status', input.status);
        }

        const { data: callouts } = await query;
        return { callouts: callouts ?? [] };
      }),
  }),
});

export type AppRouter = typeof appRouter;
