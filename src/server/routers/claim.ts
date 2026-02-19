/**
 * Claim router — handles manager approval workflow for shift claims.
 *
 * Managers see all pending claims and can approve or reject them.
 * On approve: claim→approved, callout→approved, shift reassigned, other claims rejected.
 * On reject: claim→rejected, callout reverted to 'open' if no other pending claims.
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
   * List claims with full details: callout, shift (incl. location), claimant user, caller user.
   * - Staff see only their own claims.
   * - Managers/admins see all claims in the org.
   * Optionally filter by status. Ordered by most recent first.
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
          '*, callout:callouts(*, shift:shifts(*, location:locations(id, name)), user:users(id, name, email)), claimant:users!claims_user_id_fkey(id, name, email)'
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
   * Approve a pending claim — manager/admin only.
   *
   * 1. Set claim status='approved', approved_by, approved_at
   * 2. Set callout status='approved'
   * 3. Reassign the shift to the claimant
   * 4. Reject all other pending claims for this callout
   * 5. Notify the claimant
   */
  approve: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
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

      // 1. Approve the claim
      const { data: updatedClaim, error: approveError } = await ctx.db
        .from('claims')
        .update({
          status: 'approved',
          approved_by: ctx.user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', input.id)
        .select()
        .single();

      if (approveError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to approve claim: ${approveError.message}`,
        });
      }

      // 2. Update callout status to 'approved'
      const { error: calloutError } = await ctx.db
        .from('callouts')
        .update({ status: 'approved', updated_at: new Date().toISOString() })
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
        .update({ user_id: claim.user_id, updated_at: new Date().toISOString() })
        .eq('id', shift.id);

      if (shiftError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to reassign shift: ${shiftError.message}`,
        });
      }

      // 4. Reject all other pending claims for this callout
      const { error: rejectOthersError } = await ctx.db
        .from('claims')
        .update({ status: 'rejected' })
        .eq('callout_id', claim.callout_id)
        .eq('status', 'pending')
        .neq('id', input.id);

      if (rejectOthersError) {
        console.error('[CLAIM] Failed to reject other claims:', rejectOthersError.message);
      }

      // 5. Notify the claimant
      const { data: claimant } = await ctx.db
        .from('users')
        .select('name, email')
        .eq('id', claim.user_id)
        .single();

      notifyClaimApproved({
        db: ctx.db,
        claimantId: claim.user_id,
        claimantEmail: claimant?.email ?? '',
        shiftDate: shift.date,
        shiftStartTime: shift.start_time,
        shiftEndTime: shift.end_time,
      }).catch((err) =>
        console.error('[NOTIFICATION] Failed to notify claim approved:', err)
      );

      return { claim: updatedClaim };
    }),

  /**
   * Reject a pending claim — manager/admin only.
   *
   * 1. Set claim status='rejected'
   * 2. If no other pending claims exist for this callout, revert callout to 'open'
   * 3. Notify the claimant
   */
  reject: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
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

      const callout = claim.callout;
      const shift = callout?.shift;

      // 1. Reject the claim
      const { data: updatedClaim, error: rejectError } = await ctx.db
        .from('claims')
        .update({ status: 'rejected' })
        .eq('id', input.id)
        .select()
        .single();

      if (rejectError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to reject claim: ${rejectError.message}`,
        });
      }

      // 2. Check if there are other pending claims for this callout
      const { data: otherPending } = await ctx.db
        .from('claims')
        .select('id')
        .eq('callout_id', claim.callout_id)
        .eq('status', 'pending')
        .neq('id', input.id);

      // If no other pending claims, revert callout to 'open'
      if (!otherPending || otherPending.length === 0) {
        const { error: calloutError } = await ctx.db
          .from('callouts')
          .update({ status: 'open', updated_at: new Date().toISOString() })
          .eq('id', claim.callout_id);

        if (calloutError) {
          console.error('[CLAIM] Failed to revert callout to open:', calloutError.message);
        }
      }

      // 3. Notify the claimant
      if (shift) {
        const { data: claimant } = await ctx.db
          .from('users')
          .select('name, email')
          .eq('id', claim.user_id)
          .single();

        notifyClaimRejected({
          db: ctx.db,
          claimantId: claim.user_id,
          claimantEmail: claimant?.email ?? '',
          shiftDate: shift.date,
          shiftStartTime: shift.start_time,
          shiftEndTime: shift.end_time,
        }).catch((err) =>
          console.error('[NOTIFICATION] Failed to notify claim rejected:', err)
        );
      }

      return { claim: updatedClaim };
    }),
});
