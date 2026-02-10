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
          userId: z.string().uuid().optional(),
        })
      )
      .query(async ({ ctx, input }) => {
        let query = ctx.supabase.from('shifts').select('*');

        if (input.date) {
          query = query.eq('date', input.date);
        }
        if (input.userId) {
          query = query.eq('user_id', input.userId);
        }

        const { data: shifts } = await query;
        return { shifts: shifts ?? [] };
      }),

    /** Bulk create shifts — manager/admin only */
    bulkCreate: orgProcedure
      .input(
        z.object({
          shifts: z.array(
            z.object({
              user_id: z.string().uuid(),
              date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
              start_time: z.string().regex(/^\d{2}:\d{2}$/),
              end_time: z.string().regex(/^\d{2}:\d{2}$/),
              role: z.string().min(1),
              department: z.string().min(1),
            })
          ),
        })
      )
      .mutation(async ({ ctx, input }) => {
        if (ctx.orgRole === 'staff') {
          throw new TRPCError({
            code: 'FORBIDDEN',
            message: 'Only managers and admins can bulk-create shifts',
          });
        }

        const results: { created: number; errors: string[] } = {
          created: 0,
          errors: [],
        };

        for (let i = 0; i < input.shifts.length; i++) {
          const shift = input.shifts[i];
          const { error } = await ctx.supabase.from('shifts').insert(shift);

          if (error) {
            results.errors.push(`Row ${i + 1}: ${error.message}`);
          } else {
            results.created++;
          }
        }

        return results;
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
