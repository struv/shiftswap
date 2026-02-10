/**
 * Root tRPC router.
 *
 * All sub-routers are merged here. The org context middleware is
 * applied via orgProcedure, so all org-scoped queries automatically
 * have app.current_org_id set for RLS enforcement.
 */
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, publicProcedure, authedProcedure, orgProcedure } from '../trpc';

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

  /** Shift routes (org-scoped) */
  shift: router({
    list: orgProcedure
      .input(
        z.object({
          date: z.string().optional(),
          startDate: z.string().optional(),
          endDate: z.string().optional(),
          userId: z.string().uuid().optional(),
          department: z.string().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        let query = ctx.supabase.from('shifts').select('*, user:users(id, name, email, role, department)');

        if (input.date) {
          query = query.eq('date', input.date);
        }
        if (input.startDate) {
          query = query.gte('date', input.startDate);
        }
        if (input.endDate) {
          query = query.lte('date', input.endDate);
        }
        if (input.userId) {
          query = query.eq('user_id', input.userId);
        }
        if (input.department) {
          query = query.eq('department', input.department);
        }

        query = query.order('date', { ascending: true }).order('start_time', { ascending: true });

        const { data: shifts } = await query;
        return { shifts: shifts ?? [] };
      }),
  }),

  /** Swap request routes (org-scoped) */
  swap: router({
    /** List swap requests */
    list: orgProcedure
      .input(
        z.object({
          status: z.enum(['pending', 'approved', 'denied', 'cancelled']).optional(),
          requestedBy: z.string().uuid().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        let query = ctx.supabase
          .from('swap_requests')
          .select('*, shift:shifts(*, user:users(id, name, email, role, department)), requester:users!swap_requests_requested_by_fkey(id, name, email, role, department), reviewer:users!swap_requests_reviewed_by_fkey(id, name, email)')
          .order('created_at', { ascending: false });

        if (input.status) {
          query = query.eq('status', input.status);
        }
        if (input.requestedBy) {
          query = query.eq('requested_by', input.requestedBy);
        }

        const { data: swapRequests } = await query;
        return { swapRequests: swapRequests ?? [] };
      }),

    /** Create a swap request */
    create: orgProcedure
      .input(
        z.object({
          shiftId: z.string().uuid(),
          reason: z.string().optional(),
        })
      )
      .mutation(async ({ ctx, input }) => {
        const { data, error } = await ctx.supabase
          .from('swap_requests')
          .insert({
            org_id: ctx.orgId,
            shift_id: input.shiftId,
            requested_by: ctx.user.id,
            reason: input.reason ?? null,
            status: 'pending',
          })
          .select()
          .single();

        if (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to create swap request: ${error.message}`,
          });
        }

        return { swapRequest: data };
      }),

    /** Approve a swap request (manager only) */
    approve: orgProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.orgRole !== 'manager' && ctx.orgRole !== 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Only managers can approve swap requests',
          });
        }

        const { data, error } = await ctx.supabase
          .from('swap_requests')
          .update({
            status: 'approved',
            reviewed_by: ctx.user.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', input.id)
          .eq('status', 'pending')
          .select()
          .single();

        if (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to approve swap request: ${error.message}`,
          });
        }

        return { swapRequest: data };
      }),

    /** Deny a swap request (manager only) */
    deny: orgProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        if (ctx.orgRole !== 'manager' && ctx.orgRole !== 'admin') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Only managers can deny swap requests',
          });
        }

        const { data, error } = await ctx.supabase
          .from('swap_requests')
          .update({
            status: 'denied',
            reviewed_by: ctx.user.id,
            reviewed_at: new Date().toISOString(),
          })
          .eq('id', input.id)
          .eq('status', 'pending')
          .select()
          .single();

        if (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to deny swap request: ${error.message}`,
          });
        }

        return { swapRequest: data };
      }),

    /** Cancel a swap request (requester only) */
    cancel: orgProcedure
      .input(z.object({ id: z.string().uuid() }))
      .mutation(async ({ ctx, input }) => {
        const { data, error } = await ctx.supabase
          .from('swap_requests')
          .update({
            status: 'cancelled',
          })
          .eq('id', input.id)
          .eq('requested_by', ctx.user.id)
          .eq('status', 'pending')
          .select()
          .single();

        if (error) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to cancel swap request: ${error.message}`,
          });
        }

        return { swapRequest: data };
      }),
  }),

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
