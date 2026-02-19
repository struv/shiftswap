/**
 * Claim approval workflow router.
 *
 * Handles the claim lifecycle for call-outs:
 * - Lists claims with callout/shift/user details
 * - Managers/admins approve claims (claim → approved, callout → filled, shift reassigned)
 * - Managers/admins reject claims (claim → rejected, callout → open)
 *
 * Status lifecycle: pending → approved/rejected
 */
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, orgProcedure } from '../trpc';
import {
  notifyClaimApproved,
  notifyClaimRejected,
} from '@/lib/notifications';

export const claimRouter = router({
  /**
   * List claims with callout, shift, and user details.
   * - Staff see only their own claims
   * - Managers/admins see all claims in the org
   */
  list: orgProcedure
    .input(
      z.object({
        status: z.enum(['pending', 'approved', 'rejected']).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .from('claims')
        .select(
          '*, callout:callouts(*, shift:shifts(*), caller:users!callouts_user_id_fkey(id, name, email)), claimant:users!claims_user_id_fkey(id, name, email)'
        );

      if (input.status) {
        query = query.eq('status', input.status);
      }

      // Staff only see their own claims
      if (ctx.orgRole === 'staff') {
        query = query.eq('user_id', ctx.user.id);
      }

      query = query.order('claimed_at', { ascending: false });

      const { data: claims, error } = await query;
      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch claims: ${error.message}`,
        });
      }
      return { claims: claims ?? [] };
    }),

  /**
   * Approve a claim — manager/admin only.
   * Updates claim status to 'approved', callout status to 'filled',
   * and reassigns the shift to the claimant.
   */
  approve: orgProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.orgRole === 'staff') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only managers and admins can approve claims',
        });
      }

      // Fetch the claim with callout and shift details
      const { data: claim, error: fetchError } = await ctx.db
        .from('claims')
        .select('*, callout:callouts(*, shift:shifts(*))')
        .eq('id', input.id)
        .single();

      if (fetchError || !claim) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Claim not found',
        });
      }

      if (claim.status !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot approve a claim with status "${claim.status}"`,
        });
      }

      const callout = claim.callout;
      const shift = callout?.shift;

      if (!callout || !shift) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Claim is missing callout or shift data',
        });
      }

      // Check claimant doesn't have overlapping shift
      const { data: overlaps } = await ctx.db
        .from('shifts')
        .select('id')
        .eq('user_id', claim.user_id)
        .eq('date', shift.date)
        .lt('start_time', shift.end_time)
        .gt('end_time', shift.start_time)
        .neq('id', shift.id);

      if (overlaps && overlaps.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Claimant has an overlapping shift at this time',
        });
      }

      // 1. Update claim status to approved
      const { data: updatedClaim, error: claimError } = await ctx.db
        .from('claims')
        .update({
          status: 'approved',
          approved_by: ctx.user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', input.id)
        .select()
        .single();

      if (claimError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to approve claim: ${claimError.message}`,
        });
      }

      // 2. Update callout status to 'filled' (using 'approved' as per schema enum)
      const { error: calloutError } = await ctx.db
        .from('callouts')
        .update({ status: 'approved' })
        .eq('id', claim.callout_id);

      if (calloutError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to update callout status: ${calloutError.message}`,
        });
      }

      // 3. Reassign the shift to the claimant
      const { error: shiftError } = await ctx.db
        .from('shifts')
        .update({ user_id: claim.user_id })
        .eq('id', shift.id);

      if (shiftError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to reassign shift: ${shiftError.message}`,
        });
      }

      // 4. Reject any other pending claims on this callout
      await ctx.db
        .from('claims')
        .update({ status: 'rejected' })
        .eq('callout_id', claim.callout_id)
        .eq('status', 'pending')
        .neq('id', input.id);

      // 5. Notify the claimant
      const { data: claimantUser } = await ctx.db
        .from('users')
        .select('name, email')
        .eq('id', claim.user_id)
        .single();

      notifyClaimApproved({
        db: ctx.db,
        claimantId: claim.user_id,
        claimantEmail: claimantUser?.email ?? '',
        claimantName: claimantUser?.name ?? '',
        shiftDate: shift.date,
        shiftStartTime: shift.start_time,
        shiftEndTime: shift.end_time,
      }).catch((err) => console.error('[NOTIFICATION] Failed to notify claim approved:', err));

      return { claim: updatedClaim };
    }),

  /**
   * Reject a claim — manager/admin only.
   * Updates claim status to 'rejected' and reverts the callout to 'open'.
   */
  reject: orgProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.orgRole === 'staff') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only managers and admins can reject claims',
        });
      }

      // Fetch the claim with callout and shift details
      const { data: claim, error: fetchError } = await ctx.db
        .from('claims')
        .select('*, callout:callouts(*, shift:shifts(*))')
        .eq('id', input.id)
        .single();

      if (fetchError || !claim) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Claim not found',
        });
      }

      if (claim.status !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot reject a claim with status "${claim.status}"`,
        });
      }

      // 1. Update claim status to rejected
      const { data: updatedClaim, error: claimError } = await ctx.db
        .from('claims')
        .update({ status: 'rejected' })
        .eq('id', input.id)
        .select()
        .single();

      if (claimError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to reject claim: ${claimError.message}`,
        });
      }

      // 2. Check if there are other pending claims on this callout
      const { data: otherPending } = await ctx.db
        .from('claims')
        .select('id')
        .eq('callout_id', claim.callout_id)
        .eq('status', 'pending');

      // If no other pending claims, revert callout to 'open'
      if (!otherPending || otherPending.length === 0) {
        const { error: calloutError } = await ctx.db
          .from('callouts')
          .update({ status: 'open' })
          .eq('id', claim.callout_id);

        if (calloutError) {
          console.error('[CLAIM] Failed to revert callout status:', calloutError.message);
        }
      }

      // 3. Notify the claimant
      const callout = claim.callout;
      const shift = callout?.shift;

      const { data: claimantUser } = await ctx.db
        .from('users')
        .select('name, email')
        .eq('id', claim.user_id)
        .single();

      if (shift) {
        notifyClaimRejected({
          db: ctx.db,
          claimantId: claim.user_id,
          claimantEmail: claimantUser?.email ?? '',
          claimantName: claimantUser?.name ?? '',
          shiftDate: shift.date,
          shiftStartTime: shift.start_time,
          shiftEndTime: shift.end_time,
        }).catch((err) => console.error('[NOTIFICATION] Failed to notify claim rejected:', err));
      }

      return { claim: updatedClaim };
    }),
});
