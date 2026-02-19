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
import { notifyCalloutClaimed } from '@/lib/notifications';

export const calloutRouter = router({
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
