/**
 * Callout router — handles open shift listings and claim workflow.
 *
 * Callout lifecycle: open → claimed → approved/cancelled
 * Claim lifecycle: pending → approved/rejected
 *
 * Staff browse open callouts and submit claims. Managers approve claims.
 */
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, orgProcedure } from '../trpc';
import { notifyCalloutClaimed, notifyCalloutPosted } from '@/lib/notifications';

export const calloutRouter = router({
  /**
   * Create a callout — staff marks "I can't work this shift".
   * Creates a callout record with status='open'.
   * Only the shift owner can call out. Prevents duplicate callouts.
   */
  create: orgProcedure
    .input(
      z.object({
        shiftId: z.string().uuid(),
        reason: z.string().max(500).optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch the shift to verify ownership
      const { data: shift, error: shiftError } = await ctx.db
        .from('shifts')
        .select('*, location:locations(id, name)')
        .eq('id', input.shiftId)
        .single();

      if (shiftError || !shift) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Shift not found',
        });
      }

      // Only the shift owner can call out
      if (shift.user_id !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only call out from your own shifts',
        });
      }

      // Prevent calling out for past shifts
      const today = new Date().toISOString().split('T')[0];
      if (shift.date < today) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Cannot call out from a past shift',
        });
      }

      // Check for existing open/claimed callout on this shift
      const { data: existingCallouts } = await ctx.db
        .from('callouts')
        .select('id, status')
        .eq('shift_id', input.shiftId)
        .in('status', ['open', 'claimed']);

      if (existingCallouts && existingCallouts.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A call-out already exists for this shift',
        });
      }

      // Create the callout
      const { data: callout, error: createError } = await ctx.db
        .from('callouts')
        .insert({
          org_id: ctx.orgId,
          shift_id: input.shiftId,
          user_id: ctx.user.id,
          reason: input.reason ?? null,
          status: 'open',
        })
        .select()
        .single();

      if (createError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create callout: ${createError.message}`,
        });
      }

      // Notify managers
      const { data: callerUser } = await ctx.db
        .from('users')
        .select('name')
        .eq('id', ctx.user.id)
        .single();

      notifyCalloutPosted({
        db: ctx.db,
        orgId: ctx.orgId,
        callerId: ctx.user.id,
        callerName: callerUser?.name ?? 'A team member',
        shiftDate: shift.date,
        shiftStartTime: shift.start_time,
        shiftEndTime: shift.end_time,
        calloutId: callout.id,
      }).catch((err) =>
        console.error('[NOTIFICATION] Failed to notify callout posted:', err)
      );

      return { callout };
    }),

  /**
   * List callouts with full details: shift (incl. location), user who called out.
   * Optionally filter by status. Ordered by most recent first.
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
        .select(
          '*, shift:shifts(*, location:locations(id, name)), user:users(id, name, email)'
        );

      if (input.status) {
        query = query.eq('status', input.status);
      }

      query = query.order('posted_at', { ascending: false });

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
   * Claim an open callout.
   * Creates a claim record and updates the callout status to 'claimed'.
   * Prevents claiming your own callout or double-claiming.
   */
  claim: orgProcedure
    .input(
      z.object({
        calloutId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch the callout with shift details
      const { data: callout, error: fetchError } = await ctx.db
        .from('callouts')
        .select('*, shift:shifts(*)')
        .eq('id', input.calloutId)
        .single();

      if (fetchError || !callout) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Callout not found',
        });
      }

      if (callout.status !== 'open') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'This callout has already been claimed',
        });
      }

      // Cannot claim your own callout
      if (callout.user_id === ctx.user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You cannot claim your own callout',
        });
      }

      // Check for existing claim by this user
      const { data: existingClaims } = await ctx.db
        .from('claims')
        .select('id')
        .eq('callout_id', input.calloutId)
        .eq('user_id', ctx.user.id);

      if (existingClaims && existingClaims.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'You have already claimed this callout',
        });
      }

      // Create the claim record
      const { data: claim, error: claimError } = await ctx.db
        .from('claims')
        .insert({
          org_id: ctx.orgId,
          callout_id: input.calloutId,
          user_id: ctx.user.id,
          status: 'pending',
        })
        .select()
        .single();

      if (claimError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create claim: ${claimError.message}`,
        });
      }

      // Update callout status to 'claimed'
      const { error: updateError } = await ctx.db
        .from('callouts')
        .update({ status: 'claimed', updated_at: new Date().toISOString() })
        .eq('id', input.calloutId);

      if (updateError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to update callout status: ${updateError.message}`,
        });
      }

      // Notify managers about the claim
      const { data: claimant } = await ctx.db
        .from('users')
        .select('name')
        .eq('id', ctx.user.id)
        .single();

      const { data: callerUser } = await ctx.db
        .from('users')
        .select('name')
        .eq('id', callout.user_id)
        .single();

      const shift = callout.shift;
      notifyCalloutClaimed({
        db: ctx.db,
        orgId: ctx.orgId,
        claimantId: ctx.user.id,
        claimantName: claimant?.name ?? 'Someone',
        callerName: callerUser?.name ?? 'a team member',
        shiftDate: shift?.date ?? '',
        shiftStartTime: shift?.start_time ?? '',
        shiftEndTime: shift?.end_time ?? '',
        calloutId: callout.id,
      }).catch((err) =>
        console.error('[NOTIFICATION] Failed to notify callout claimed:', err)
      );

      return { claim };
    }),
});
