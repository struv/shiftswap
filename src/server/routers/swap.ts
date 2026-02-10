/**
 * Swap request workflow router.
 *
 * Handles the full swap request lifecycle:
 * - Staff creates a swap request for one of their shifts
 * - Managers/admins approve or deny requests
 * - Requesters can cancel their own pending requests
 *
 * On approval, the shift's user_id is updated to the replacement user.
 * Status lifecycle: pending → approved/denied/cancelled
 */
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, orgProcedure } from '../trpc';
import {
  notifySwapRequested,
  notifySwapApproved,
  notifySwapDenied,
} from '@/lib/notifications';

export const swapRouter = router({
  /**
   * List swap requests.
   * - Staff see: requests they created + requests targeting their shifts
   * - Managers/admins see: all swap requests in the org (via org member scoping)
   */
  list: orgProcedure
    .input(
      z.object({
        status: z.enum(['pending', 'approved', 'denied', 'cancelled']).optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      let query = ctx.db
        .from('swap_requests')
        .select('*, shift:shifts(*, user:users(id, name, email)), requester:users!swap_requests_requested_by_fkey(id, name, email)');

      if (input.status) {
        query = query.eq('status', input.status);
      }

      // Staff only see their own requests or requests for their shifts
      if (ctx.orgRole === 'staff') {
        query = query.or(`requested_by.eq.${ctx.user.id},shift.user_id.eq.${ctx.user.id}`);
      }

      query = query.order('created_at', { ascending: false });

      const { data: swaps, error } = await query;
      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch swap requests: ${error.message}`,
        });
      }
      return { swaps: swaps ?? [] };
    }),

  /**
   * Create a swap request.
   * Any authenticated user can create a request for a shift they own.
   */
  create: orgProcedure
    .input(
      z.object({
        shiftId: z.string().uuid(),
        replacementUserId: z.string().uuid().optional(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the shift exists and belongs to the requester
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
          message: 'You can only create swap requests for your own shifts',
        });
      }

      // Check for existing pending swap request on this shift
      const { data: existing } = await ctx.db
        .from('swap_requests')
        .select('id')
        .eq('shift_id', input.shiftId)
        .eq('status', 'pending');

      if (existing && existing.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A pending swap request already exists for this shift',
        });
      }

      // If replacement user specified, verify they exist
      if (input.replacementUserId) {
        const { data: replacement, error: replError } = await ctx.db
          .from('users')
          .select('id')
          .eq('id', input.replacementUserId)
          .single();

        if (replError || !replacement) {
          throw new TRPCError({
            code: 'NOT_FOUND',
            message: 'Replacement user not found',
          });
        }

        if (input.replacementUserId === ctx.user.id) {
          throw new TRPCError({
            code: 'BAD_REQUEST',
            message: 'Cannot set yourself as the replacement user',
          });
        }
      }

      const { data: swap, error } = await ctx.db
        .from('swap_requests')
        .insert({
          shift_id: input.shiftId,
          requested_by: ctx.user.id,
          replacement_user_id: input.replacementUserId ?? null,
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

      // Notify managers about the new swap request
      const { data: requester } = await ctx.db
        .from('users')
        .select('name')
        .eq('id', ctx.user.id)
        .single();

      notifySwapRequested({
        db: ctx.db,
        orgId: ctx.orgId,
        requesterId: ctx.user.id,
        requesterName: requester?.name ?? ctx.user.email,
        shiftDate: shift.date,
        shiftStartTime: shift.start_time,
        shiftEndTime: shift.end_time,
        swapId: swap.id,
      }).catch((err) => console.error('[NOTIFICATION] Failed to notify swap request:', err));

      return { swap };
    }),

  /**
   * Approve a swap request — manager/admin only.
   * Updates the swap status and reassigns the shift to the replacement user.
   */
  approve: orgProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        replacementUserId: z.string().uuid().optional(),
        managerNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.orgRole === 'staff') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only managers and admins can approve swap requests',
        });
      }

      // Fetch the swap request
      const { data: swap, error: fetchError } = await ctx.db
        .from('swap_requests')
        .select('*, shift:shifts(*)')
        .eq('id', input.id)
        .single();

      if (fetchError || !swap) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Swap request not found',
        });
      }

      if (swap.status !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot approve a swap request with status "${swap.status}"`,
        });
      }

      // Determine replacement user: from input or from the request itself
      const replacementUserId = input.replacementUserId ?? swap.replacement_user_id;
      if (!replacementUserId) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'A replacement user must be specified to approve this swap',
        });
      }

      // Verify replacement user exists
      const { data: replacement, error: replError } = await ctx.db
        .from('users')
        .select('id')
        .eq('id', replacementUserId)
        .single();

      if (replError || !replacement) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Replacement user not found',
        });
      }

      // Check replacement user doesn't have overlapping shift
      const shift = swap.shift;
      const { data: overlaps } = await ctx.db
        .from('shifts')
        .select('id')
        .eq('user_id', replacementUserId)
        .eq('date', shift.date)
        .lt('start_time', shift.end_time)
        .gt('end_time', shift.start_time)
        .neq('id', shift.id);

      if (overlaps && overlaps.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'Replacement user has an overlapping shift at this time',
        });
      }

      // Update swap request status
      const { data: updatedSwap, error: updateError } = await ctx.db
        .from('swap_requests')
        .update({
          status: 'approved',
          replacement_user_id: replacementUserId,
          reviewed_by: ctx.user.id,
          reviewed_at: new Date().toISOString(),
          manager_notes: input.managerNotes ?? null,
        })
        .eq('id', input.id)
        .select()
        .single();

      if (updateError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to approve swap request: ${updateError.message}`,
        });
      }

      // Reassign the shift to the replacement user
      const { error: shiftError } = await ctx.db
        .from('shifts')
        .update({ user_id: replacementUserId })
        .eq('id', swap.shift_id);

      if (shiftError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to reassign shift: ${shiftError.message}`,
        });
      }

      // Notify the requester that their swap was approved
      const { data: requesterUser } = await ctx.db
        .from('users')
        .select('email')
        .eq('id', swap.requested_by)
        .single();

      notifySwapApproved({
        db: ctx.db,
        requesterId: swap.requested_by,
        requesterEmail: requesterUser?.email ?? '',
        shiftDate: shift.date,
        shiftStartTime: shift.start_time,
        shiftEndTime: shift.end_time,
        swapId: swap.id,
        managerNotes: input.managerNotes,
      }).catch((err) => console.error('[NOTIFICATION] Failed to notify swap approved:', err));

      return { swap: updatedSwap };
    }),

  /**
   * Deny a swap request — manager/admin only.
   */
  deny: orgProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        managerNotes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.orgRole === 'staff') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only managers and admins can deny swap requests',
        });
      }

      // Fetch the swap request with shift details
      const { data: swap, error: fetchError } = await ctx.db
        .from('swap_requests')
        .select('*, shift:shifts(*)')
        .eq('id', input.id)
        .single();

      if (fetchError || !swap) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Swap request not found',
        });
      }

      if (swap.status !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot deny a swap request with status "${swap.status}"`,
        });
      }

      const { data: updatedSwap, error } = await ctx.db
        .from('swap_requests')
        .update({
          status: 'denied',
          reviewed_by: ctx.user.id,
          reviewed_at: new Date().toISOString(),
          manager_notes: input.managerNotes ?? null,
        })
        .eq('id', input.id)
        .select()
        .single();

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to deny swap request: ${error.message}`,
        });
      }

      // Notify the requester that their swap was denied
      const shift = swap.shift;
      const { data: requesterUser } = await ctx.db
        .from('users')
        .select('email')
        .eq('id', swap.requested_by)
        .single();

      notifySwapDenied({
        db: ctx.db,
        requesterId: swap.requested_by,
        requesterEmail: requesterUser?.email ?? '',
        shiftDate: shift.date,
        shiftStartTime: shift.start_time,
        shiftEndTime: shift.end_time,
        swapId: swap.id,
        managerNotes: input.managerNotes,
      }).catch((err) => console.error('[NOTIFICATION] Failed to notify swap denied:', err));

      return { swap: updatedSwap };
    }),

  /**
   * Cancel a swap request — requester only, while still pending.
   */
  cancel: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { data: swap, error: fetchError } = await ctx.db
        .from('swap_requests')
        .select('*')
        .eq('id', input.id)
        .single();

      if (fetchError || !swap) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Swap request not found',
        });
      }

      if (swap.requested_by !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only cancel your own swap requests',
        });
      }

      if (swap.status !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot cancel a swap request with status "${swap.status}"`,
        });
      }

      const { data: updatedSwap, error } = await ctx.db
        .from('swap_requests')
        .update({ status: 'cancelled' })
        .eq('id', input.id)
        .select()
        .single();

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to cancel swap request: ${error.message}`,
        });
      }

      return { swap: updatedSwap };
    }),
});
