/**
 * Callout and shift claim workflow router.
 *
 * Handles the full shift claim lifecycle:
 * - List open callouts (shifts available to pick up)
 * - Staff claims an open shift ("I'll take it") → pending claim
 * - Managers approve or reject claims
 *
 * Status lifecycle:
 *   Callout: open → claimed → approved / cancelled
 *   Claim:   pending → approved / rejected
 */
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, orgProcedure } from '../trpc';
import {
  notifyClaimCreated,
  notifyClaimApproved,
  notifyClaimRejected,
} from '@/lib/notifications';

export const calloutRouter = router({
  /**
   * List callouts, optionally filtered by status.
   * Includes the associated shift and the user who called out.
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
        .select('*, shift:shifts(*, user:users(id, name, email)), user:users!callouts_user_id_fkey(id, name, email), claims:claims(*, user:users(id, name, email), approver:users!claims_approved_by_fkey(id, name))');

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
   * Claim an open shift — any staff member (except the one who called out).
   * Creates a claim record with status='pending' and updates callout to 'claimed'.
   * Notifies managers for approval.
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
          message: `Cannot claim a callout with status "${callout.status}"`,
        });
      }

      // Prevent the person who called out from claiming their own shift
      if (callout.user_id === ctx.user.id) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'You cannot claim your own callout',
        });
      }

      // Check for existing pending claim by this user on this callout
      const { data: existingClaim } = await ctx.db
        .from('claims')
        .select('id')
        .eq('callout_id', input.calloutId)
        .eq('user_id', ctx.user.id)
        .eq('status', 'pending');

      if (existingClaim && existingClaim.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'You already have a pending claim on this callout',
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
          claimed_at: new Date().toISOString(),
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
        .update({
          status: 'claimed',
          updated_at: new Date().toISOString(),
        })
        .eq('id', input.calloutId);

      if (updateError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to update callout status: ${updateError.message}`,
        });
      }

      // Notify managers
      const { data: claimer } = await ctx.db
        .from('users')
        .select('name')
        .eq('id', ctx.user.id)
        .single();

      const shift = callout.shift;
      notifyClaimCreated({
        db: ctx.db,
        orgId: ctx.orgId,
        claimerId: ctx.user.id,
        claimerName: claimer?.name ?? ctx.user.email,
        shiftDate: shift.date,
        shiftStartTime: shift.start_time,
        shiftEndTime: shift.end_time,
        claimId: claim.id,
      }).catch((err) => console.error('[NOTIFICATION] Failed to notify claim created:', err));

      return { claim };
    }),

  /**
   * Approve a claim — manager/admin only.
   * Updates claim status to 'approved', callout status to 'approved',
   * and reassigns the shift to the claimer.
   */
  approveClaim: orgProcedure
    .input(
      z.object({
        claimId: z.string().uuid(),
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
        .eq('id', input.claimId)
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

      const shift = claim.callout?.shift;
      if (!shift) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: 'Could not find the associated shift',
        });
      }

      // Check for overlapping shifts for the claimer
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
          message: 'The claimer has an overlapping shift at this time',
        });
      }

      // Update claim status
      const { data: updatedClaim, error: claimUpdateError } = await ctx.db
        .from('claims')
        .update({
          status: 'approved',
          approved_by: ctx.user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', input.claimId)
        .select()
        .single();

      if (claimUpdateError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to approve claim: ${claimUpdateError.message}`,
        });
      }

      // Update callout status to 'approved'
      const { error: calloutUpdateError } = await ctx.db
        .from('callouts')
        .update({
          status: 'approved',
          updated_at: new Date().toISOString(),
        })
        .eq('id', claim.callout_id);

      if (calloutUpdateError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to update callout: ${calloutUpdateError.message}`,
        });
      }

      // Reassign the shift to the claimer
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

      // Reject any other pending claims on this callout
      await ctx.db
        .from('claims')
        .update({ status: 'rejected' })
        .eq('callout_id', claim.callout_id)
        .eq('status', 'pending')
        .neq('id', input.claimId);

      // Notify the claimer
      const { data: claimerUser } = await ctx.db
        .from('users')
        .select('email')
        .eq('id', claim.user_id)
        .single();

      notifyClaimApproved({
        db: ctx.db,
        claimerId: claim.user_id,
        claimerEmail: claimerUser?.email ?? '',
        shiftDate: shift.date,
        shiftStartTime: shift.start_time,
        shiftEndTime: shift.end_time,
        claimId: claim.id,
      }).catch((err) => console.error('[NOTIFICATION] Failed to notify claim approved:', err));

      return { claim: updatedClaim };
    }),

  /**
   * Reject a claim — manager/admin only.
   * If this was the only pending claim, reverts the callout status back to 'open'.
   */
  rejectClaim: orgProcedure
    .input(
      z.object({
        claimId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.orgRole === 'staff') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only managers and admins can reject claims',
        });
      }

      // Fetch the claim with callout and shift
      const { data: claim, error: fetchError } = await ctx.db
        .from('claims')
        .select('*, callout:callouts(*, shift:shifts(*))')
        .eq('id', input.claimId)
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

      // Reject the claim
      const { data: updatedClaim, error: updateError } = await ctx.db
        .from('claims')
        .update({ status: 'rejected' })
        .eq('id', input.claimId)
        .select()
        .single();

      if (updateError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to reject claim: ${updateError.message}`,
        });
      }

      // Check if there are any remaining pending claims on this callout
      const { data: remainingClaims } = await ctx.db
        .from('claims')
        .select('id')
        .eq('callout_id', claim.callout_id)
        .eq('status', 'pending');

      // If no more pending claims, revert callout to 'open'
      if (!remainingClaims || remainingClaims.length === 0) {
        await ctx.db
          .from('callouts')
          .update({
            status: 'open',
            updated_at: new Date().toISOString(),
          })
          .eq('id', claim.callout_id);
      }

      // Notify the claimer
      const shift = claim.callout?.shift;
      const { data: claimerUser } = await ctx.db
        .from('users')
        .select('email')
        .eq('id', claim.user_id)
        .single();

      if (shift) {
        notifyClaimRejected({
          db: ctx.db,
          claimerId: claim.user_id,
          claimerEmail: claimerUser?.email ?? '',
          shiftDate: shift.date,
          shiftStartTime: shift.start_time,
          shiftEndTime: shift.end_time,
          claimId: claim.id,
        }).catch((err) => console.error('[NOTIFICATION] Failed to notify claim rejected:', err));
      }

      return { claim: updatedClaim };
    }),
});
