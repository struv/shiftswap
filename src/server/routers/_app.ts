/**
 * Root tRPC router.
 *
 * All sub-routers are merged here. The org context middleware is
 * applied via orgProcedure, so all org-scoped queries automatically
 * have app.current_org_id set for RLS enforcement.
 */
import { router, publicProcedure, authedProcedure, orgProcedure } from '../trpc';
import { shiftRouter } from './shift';
import { swapRouter } from './swap';
import { notificationRouter } from './notification';
import { calloutRouter } from './callout';

export const appRouter = router({
  /** Health check — public, no auth required */
  health: publicProcedure.query(() => {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }),

  /** Get current authenticated user info */
  me: authedProcedure.query(async ({ ctx }) => {
    const { data: profile } = await ctx.db
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
      const { data: org } = await ctx.db
        .from('organizations')
        .select('*')
        .eq('id', ctx.orgId)
        .single();

      return { org, role: ctx.orgRole };
    }),

    /** List members in the current organization */
    members: orgProcedure.query(async ({ ctx }) => {
      const { data: members } = await ctx.db
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

  /** Notification routes (org-scoped) */
  notification: notificationRouter,

  /** Callout routes (org-scoped) */
  callout: calloutRouter,
});

export type AppRouter = typeof appRouter;
