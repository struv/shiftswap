/**
 * Claim approval router — managers approve or deny pending shift claims.
 *
 * Claim lifecycle: pending → approved/rejected
 * On approve: claim status='approved', callout status='filled', shift reassigned.
 * On deny: claim status='rejected', callout reverted to 'open'.
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
   * List claims with full details: callout, shift (incl. location),
   * claimant user, and original caller.
   * Managers/admins see all claims; staff only see their own.
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
          '*, callout:callouts(*, shift:shifts(*, location:locations(id, name)), user:users(id, name, email)), user:users(id, name, email)'
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
   * reassigns the shift to the claimant, and rejects other pending claims.
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
          message: 'Could not resolve callout or shift for this claim',
        });
      }

      // Update claim status to 'approved'
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

      // Update callout status to 'approved' (filled)
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

      // Reassign the shift to the claimant
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

      // Reject other pending claims on the same callout
      const { data: otherClaims } = await ctx.db
        .from('claims')
        .select('id, user_id')
        .eq('callout_id', claim.callout_id)
        .eq('status', 'pending')
        .neq('id', input.id);

      if (otherClaims && otherClaims.length > 0) {
        for (const other of otherClaims) {
          await ctx.db
            .from('claims')
            .update({ status: 'rejected' })
            .eq('id', other.id);

          // Notify rejected claimants
          const { data: rejectedUser } = await ctx.db
            .from('users')
            .select('email')
            .eq('id', other.user_id)
            .single();

          notifyClaimRejected({
            db: ctx.db,
            claimantId: other.user_id,
            claimantEmail: rejectedUser?.email ?? '',
            shiftDate: shift.date,
            shiftStartTime: shift.start_time,
            shiftEndTime: shift.end_time,
            calloutId: claim.callout_id,
          }).catch((err) =>
            console.error('[NOTIFICATION] Failed to notify rejected claimant:', err)
          );
        }
      }

      // Notify the approved claimant
      const { data: claimantUser } = await ctx.db
        .from('users')
        .select('email')
        .eq('id', claim.user_id)
        .single();

      notifyClaimApproved({
        db: ctx.db,
        claimantId: claim.user_id,
        claimantEmail: claimantUser?.email ?? '',
        shiftDate: shift.date,
        shiftStartTime: shift.start_time,
        shiftEndTime: shift.end_time,
        calloutId: claim.callout_id,
      }).catch((err) =>
        console.error('[NOTIFICATION] Failed to notify claim approved:', err)
      );

      return { claim: updatedClaim };
    }),

  /**
   * Deny a claim — manager/admin only.
   * Updates claim status to 'rejected' and reverts callout to 'open'
   * if no other pending claims remain.
   */
  deny: orgProcedure
    .input(
      z.object({
        id: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.orgRole === 'staff') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only managers and admins can deny claims',
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
          message: `Cannot deny a claim with status "${claim.status}"`,
        });
      }

      const callout = claim.callout;
      const shift = callout?.shift;

      // Update claim status to 'rejected'
      const { data: updatedClaim, error: claimError } = await ctx.db
        .from('claims')
        .update({ status: 'rejected' })
        .eq('id', input.id)
        .select()
        .single();

      if (claimError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to deny claim: ${claimError.message}`,
        });
      }

      // Check if there are other pending claims on this callout
      const { data: remainingClaims } = await ctx.db
        .from('claims')
        .select('id')
        .eq('callout_id', claim.callout_id)
        .eq('status', 'pending');

      // If no other pending claims, revert callout to 'open'
      if (!remainingClaims || remainingClaims.length === 0) {
        const { error: calloutError } = await ctx.db
          .from('callouts')
          .update({ status: 'open', updated_at: new Date().toISOString() })
          .eq('id', claim.callout_id);

        if (calloutError) {
          throw new TRPCError({
            code: 'INTERNAL_SERVER_ERROR',
            message: `Failed to revert callout status: ${calloutError.message}`,
          });
        }
      }

      // Notify the denied claimant
      if (callout && shift) {
        const { data: claimantUser } = await ctx.db
          .from('users')
          .select('email')
          .eq('id', claim.user_id)
          .single();

        notifyClaimRejected({
          db: ctx.db,
          claimantId: claim.user_id,
          claimantEmail: claimantUser?.email ?? '',
          shiftDate: shift.date,
          shiftStartTime: shift.start_time,
          shiftEndTime: shift.end_time,
          calloutId: claim.callout_id,
        }).catch((err) =>
          console.error('[NOTIFICATION] Failed to notify claim denied:', err)
        );
      }

      return { claim: updatedClaim };
    }),
});
