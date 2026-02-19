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
import { createNotification } from '@/lib/notifications';

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
   * List pending claims for manager review.
   * Returns claims with claimant and callout/shift details.
   * Managers/admins only.
   */
  listClaims: orgProcedure
    .input(
      z.object({
        status: z.enum(['pending', 'approved', 'rejected']).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      if (ctx.orgRole !== 'manager' && ctx.orgRole !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only managers can view pending claims',
        });
      }

      let query = ctx.db
        .from('claims')
        .select(
          '*, user:users(id, name, email), callout:callouts(*, shift:shifts(*, location:locations(id, name)), user:users(id, name, email))'
        );

      if (input.status) {
        query = query.eq('status', input.status);
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

  /**
   * Approve a pending claim.
   * Sets claim status to 'approved', callout status to 'approved',
   * transfers the shift to the claimant, and notifies the claimant.
   * Managers/admins only.
   */
  approveClaim: orgProcedure
    .input(
      z.object({
        claimId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.orgRole !== 'manager' && ctx.orgRole !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only managers can approve claims',
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
          message: `Claim has already been ${claim.status}`,
        });
      }

      // Update claim to approved
      const { error: claimUpdateError } = await ctx.db
        .from('claims')
        .update({
          status: 'approved',
          approved_by: ctx.user.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', input.claimId);

      if (claimUpdateError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to approve claim: ${claimUpdateError.message}`,
        });
      }

      // Update callout status to 'approved'
      const callout = claim.callout;
      if (callout) {
        await ctx.db
          .from('callouts')
          .update({ status: 'approved', updated_at: new Date().toISOString() })
          .eq('id', callout.id);

        // Transfer shift ownership to the claimant
        const shift = callout.shift;
        if (shift) {
          await ctx.db
            .from('shifts')
            .update({ user_id: claim.user_id, updated_at: new Date().toISOString() })
            .eq('id', shift.id);
        }
      }

      // Notify the claimant that their claim was approved
      const shift = callout?.shift;
      createNotification({
        db: ctx.db,
        userId: claim.user_id,
        type: 'callout_claimed',
        title: 'Claim Approved',
        message: `Your claim for the shift on ${shift?.date ?? 'unknown date'} (${shift?.start_time ?? ''} - ${shift?.end_time ?? ''}) has been approved.`,
        link: '/callouts',
      }).catch((err) =>
        console.error('[NOTIFICATION] Failed to notify claim approved:', err)
      );

      return { success: true };
    }),

  /**
   * Reject a pending claim.
   * Sets claim status to 'rejected', reverts callout status to 'open',
   * and notifies the claimant.
   * Managers/admins only.
   */
  rejectClaim: orgProcedure
    .input(
      z.object({
        claimId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.orgRole !== 'manager' && ctx.orgRole !== 'admin') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only managers can reject claims',
        });
      }

      // Fetch the claim with callout details
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
          message: `Claim has already been ${claim.status}`,
        });
      }

      // Update claim to rejected
      const { error: claimUpdateError } = await ctx.db
        .from('claims')
        .update({ status: 'rejected' })
        .eq('id', input.claimId);

      if (claimUpdateError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to reject claim: ${claimUpdateError.message}`,
        });
      }

      // Revert callout status to 'open' so someone else can claim it
      const callout = claim.callout;
      if (callout) {
        await ctx.db
          .from('callouts')
          .update({ status: 'open', updated_at: new Date().toISOString() })
          .eq('id', callout.id);
      }

      // Notify the claimant that their claim was rejected
      const shift = callout?.shift;
      createNotification({
        db: ctx.db,
        userId: claim.user_id,
        type: 'callout_claimed',
        title: 'Claim Rejected',
        message: `Your claim for the shift on ${shift?.date ?? 'unknown date'} (${shift?.start_time ?? ''} - ${shift?.end_time ?? ''}) was not approved. The shift is now open for others.`,
        link: '/callouts',
      }).catch((err) =>
        console.error('[NOTIFICATION] Failed to notify claim rejected:', err)
      );

      return { success: true };
    }),
});
