/**
 * Callout router.
 *
 * Handles the call-out posting workflow:
 * - Staff can view their upcoming shifts eligible for call-out
 * - Staff can post a call-out on their own shift (status='open')
 * - Staff can cancel their own open call-outs
 * - List open call-outs for the org
 *
 * Status lifecycle: open → claimed/cancelled (→ approved)
 */
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, orgProcedure } from '../trpc';
import { createNotification } from '@/lib/notifications';

export const calloutRouter = router({
  /**
   * List callouts with optional status filter.
   * Returns callout records with embedded shift and user details.
   */
  list: orgProcedure
    .input(
      z.object({
        status: z
          .enum(['open', 'claimed', 'approved', 'cancelled'])
          .optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .from('callouts')
        .select('*, shift:shifts(*, user:users(id, name, email)), user:users(id, name, email)');

      if (input.status) {
        query = query.eq('status', input.status);
      }

      query = query.order('created_at', { ascending: false });

      const { data: callouts, error } = await query;
      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch callouts: ${error.message}`,
        });
      }
      return { callouts: callouts ?? [] };
    }),

  /**
   * Get the current user's upcoming shifts that are eligible for call-out.
   * Filters out shifts that already have an open/claimed callout.
   */
  myShifts: orgProcedure.query(async ({ ctx }) => {
    const today = new Date().toISOString().split('T')[0];

    // Fetch user's upcoming shifts
    const { data: shifts, error: shiftError } = await ctx.db
      .from('shifts')
      .select('*')
      .eq('user_id', ctx.user.id)
      .gte('date', today)
      .order('date')
      .order('start_time');

    if (shiftError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to fetch shifts: ${shiftError.message}`,
      });
    }

    if (!shifts || shifts.length === 0) {
      return { shifts: [] };
    }

    // Fetch existing open/claimed callouts for these shifts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const shiftIds = shifts.map((s: any) => s.id);
    const { data: existingCallouts } = await ctx.db
      .from('callouts')
      .select('shift_id')
      .in('shift_id', shiftIds)
      .in('status', ['open', 'claimed']);

    const calledOutShiftIds = new Set(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (existingCallouts ?? []).map((c: any) => c.shift_id)
    );

    // Mark which shifts already have callouts
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const enrichedShifts = shifts.map((shift: any) => ({
      ...shift,
      has_callout: calledOutShiftIds.has(shift.id),
    }));

    return { shifts: enrichedShifts };
  }),

  /**
   * Post a call-out on a shift.
   * The user must own the shift, and no open/claimed callout can exist for it.
   */
  create: orgProcedure
    .input(
      z.object({
        shiftId: z.string().uuid(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the shift exists and belongs to the user
      const { data: shift, error: shiftError } = await ctx.db
        .from('shifts')
        .select('*')
        .eq('id', input.shiftId)
        .single();

      if (shiftError || !shift) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Shift not found',
        });
      }

      if (shift.user_id !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only post call-outs for your own shifts',
        });
      }

      // Check for existing open/claimed callout on this shift
      const { data: existing } = await ctx.db
        .from('callouts')
        .select('id')
        .eq('shift_id', input.shiftId)
        .in('status', ['open', 'claimed']);

      if (existing && existing.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A call-out already exists for this shift',
        });
      }

      // Create the callout
      const { data: callout, error } = await ctx.db
        .from('callouts')
        .insert({
          shift_id: input.shiftId,
          user_id: ctx.user.id,
          reason: input.reason ?? null,
          status: 'open',
          posted_at: new Date().toISOString(),
        })
        .select()
        .single();

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create call-out: ${error.message}`,
        });
      }

      // Notify managers about the new call-out
      const { data: poster } = await ctx.db
        .from('users')
        .select('name')
        .eq('id', ctx.user.id)
        .single();

      const posterName = poster?.name ?? ctx.user.email;

      const { data: managers } = await ctx.db
        .from('org_members')
        .select('user_id')
        .eq('org_id', ctx.orgId)
        .in('role', ['manager', 'admin'])
        .neq('user_id', ctx.user.id);

      if (managers && managers.length > 0) {
        const message = `${posterName} can't work their shift on ${shift.date} (${shift.start_time} - ${shift.end_time}) and posted a call-out.`;

        for (const manager of managers) {
          createNotification({
            db: ctx.db,
            userId: manager.user_id,
            type: 'swap_request',
            title: 'New Call-Out Posted',
            message,
            link: '/callouts',
          }).catch((err) =>
            console.error('[NOTIFICATION] Failed to notify call-out:', err)
          );
        }
      }

      return { callout };
    }),

  /**
   * Cancel an open call-out — only the poster can cancel.
   */
  cancel: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: callout, error: fetchError } = await ctx.db
        .from('callouts')
        .select('*')
        .eq('id', input.id)
        .single();

      if (fetchError || !callout) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Call-out not found',
        });
      }

      if (callout.user_id !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only cancel your own call-outs',
        });
      }

      if (callout.status !== 'open') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot cancel a call-out with status "${callout.status}"`,
        });
      }

      const { data: updated, error } = await ctx.db
        .from('callouts')
        .update({ status: 'cancelled' })
        .eq('id', input.id)
        .select()
        .single();

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to cancel call-out: ${error.message}`,
        });
      }

      return { callout: updated };
    }),
});
