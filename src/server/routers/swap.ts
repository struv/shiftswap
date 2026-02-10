import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, managerProcedure } from '../trpc/init';
import type { Shift, SwapRequest } from '@/types/database';

type ShiftTimeslot = Pick<Shift, 'id' | 'start_time' | 'end_time'>;

export const swapRouter = router({
  /**
   * List swap requests visible to the current user.
   * Staff see: requests they created + requests targeting their shifts.
   * Managers/admins see all swap requests.
   */
  list: protectedProcedure
    .input(
      z
        .object({
          status: z
            .enum(['pending', 'approved', 'denied', 'cancelled'])
            .optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      const isManager =
        ctx.profile.role === 'manager' || ctx.profile.role === 'admin';

      let query = ctx.supabase.from('swap_requests').select('*');

      if (input?.status) {
        query = query.eq('status', input.status);
      }

      if (!isManager) {
        // Staff see their own requests + requests for shifts they own
        const { data: userShiftIds } = (await ctx.supabase
          .from('shifts')
          .select('id')
          .eq('user_id', ctx.user.id)) as { data: { id: string }[] | null };

        const shiftIds = (userShiftIds ?? []).map((s) => s.id);

        query = query.or(
          `requester_id.eq.${ctx.user.id}${shiftIds.length > 0 ? `,shift_id.in.(${shiftIds.join(',')})` : ''}`
        );
      }

      query = query.order('created_at', { ascending: false });

      const { data, error } = (await query) as {
        data: SwapRequest[] | null;
        error: { message: string } | null;
      };

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }

      return data ?? [];
    }),

  /**
   * Create a swap request.
   * Staff member requests to swap/give up one of their shifts.
   */
  create: protectedProcedure
    .input(
      z.object({
        shiftId: z.string().uuid(),
        notes: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Verify the shift belongs to the requesting user
      const { data: shift, error: shiftError } = (await ctx.supabase
        .from('shifts')
        .select('*')
        .eq('id', input.shiftId)
        .single()) as { data: Shift | null; error: { message: string } | null };

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

      // Check no pending swap request already exists for this shift
      const { data: existingRequests } = (await ctx.supabase
        .from('swap_requests')
        .select('id')
        .eq('shift_id', input.shiftId)
        .eq('status', 'pending')) as { data: { id: string }[] | null };

      if (existingRequests && existingRequests.length > 0) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'A pending swap request already exists for this shift',
        });
      }

      const { data, error } = (await ctx.supabase
        .from('swap_requests')
        .insert({
          shift_id: input.shiftId,
          requester_id: ctx.user.id,
          notes: input.notes ?? null,
          status: 'pending',
        } as never)
        .select()
        .single()) as { data: SwapRequest | null; error: { message: string } | null };

      if (error || !data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error?.message ?? 'Failed to create swap request',
        });
      }

      return data;
    }),

  /**
   * Approve a swap request. Manager/admin only.
   * Assigns the replacement user to the shift.
   */
  approve: managerProcedure
    .input(
      z.object({
        requestId: z.string().uuid(),
        replacementUserId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      // Fetch the swap request
      const { data: request, error: reqError } = (await ctx.supabase
        .from('swap_requests')
        .select('*')
        .eq('id', input.requestId)
        .single()) as { data: SwapRequest | null; error: { message: string } | null };

      if (reqError || !request) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Swap request not found',
        });
      }

      if (request.status !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot approve a request with status "${request.status}"`,
        });
      }

      // Verify the replacement user exists
      const { data: replacementUser, error: userError } = (await ctx.supabase
        .from('users')
        .select('id')
        .eq('id', input.replacementUserId)
        .single()) as { data: { id: string } | null; error: { message: string } | null };

      if (userError || !replacementUser) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Replacement user not found',
        });
      }

      // Fetch the shift to check for overlaps with the replacement user
      const { data: shift } = (await ctx.supabase
        .from('shifts')
        .select('*')
        .eq('id', request.shift_id)
        .single()) as { data: Shift | null };

      if (!shift) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Associated shift not found',
        });
      }

      // Check that replacement user doesn't have an overlapping shift
      const { data: existingShifts } = (await ctx.supabase
        .from('shifts')
        .select('id, start_time, end_time')
        .eq('user_id', input.replacementUserId)
        .eq('date', shift.date)
        .neq('id', shift.id)) as { data: ShiftTimeslot[] | null };

      const hasOverlap = (existingShifts ?? []).some(
        (s) => shift.start_time < s.end_time && shift.end_time > s.start_time
      );

      if (hasOverlap) {
        throw new TRPCError({
          code: 'CONFLICT',
          message:
            'Replacement user already has an overlapping shift on this date',
        });
      }

      // Update the swap request status
      const { data: updatedRequest, error: updateReqError } = (await ctx.supabase
        .from('swap_requests')
        .update({
          status: 'approved',
          replacement_user_id: input.replacementUserId,
        } as never)
        .eq('id', input.requestId)
        .select()
        .single()) as { data: SwapRequest | null; error: { message: string } | null };

      if (updateReqError || !updatedRequest) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: updateReqError?.message ?? 'Failed to approve request',
        });
      }

      // Update the shift to assign to replacement user
      const { error: shiftUpdateError } = (await ctx.supabase
        .from('shifts')
        .update({ user_id: input.replacementUserId } as never)
        .eq('id', request.shift_id)) as { error: { message: string } | null };

      if (shiftUpdateError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: shiftUpdateError.message,
        });
      }

      return updatedRequest;
    }),

  /**
   * Deny a swap request. Manager/admin only.
   */
  deny: managerProcedure
    .input(
      z.object({
        requestId: z.string().uuid(),
        reason: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { data: request, error: reqError } = (await ctx.supabase
        .from('swap_requests')
        .select('*')
        .eq('id', input.requestId)
        .single()) as { data: SwapRequest | null; error: { message: string } | null };

      if (reqError || !request) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Swap request not found',
        });
      }

      if (request.status !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot deny a request with status "${request.status}"`,
        });
      }

      const { data, error } = (await ctx.supabase
        .from('swap_requests')
        .update({
          status: 'denied',
          reason: input.reason ?? null,
        } as never)
        .eq('id', input.requestId)
        .select()
        .single()) as { data: SwapRequest | null; error: { message: string } | null };

      if (error || !data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error?.message ?? 'Failed to deny request',
        });
      }

      return data;
    }),

  /**
   * Cancel a swap request. Only the requester can cancel, and only if pending.
   */
  cancel: protectedProcedure
    .input(
      z.object({
        requestId: z.string().uuid(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      const { data: request, error: reqError } = (await ctx.supabase
        .from('swap_requests')
        .select('*')
        .eq('id', input.requestId)
        .single()) as { data: SwapRequest | null; error: { message: string } | null };

      if (reqError || !request) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Swap request not found',
        });
      }

      if (request.requester_id !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only the requester can cancel a swap request',
        });
      }

      if (request.status !== 'pending') {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Cannot cancel a request with status "${request.status}"`,
        });
      }

      const { data, error } = (await ctx.supabase
        .from('swap_requests')
        .update({ status: 'cancelled' } as never)
        .eq('id', input.requestId)
        .select()
        .single()) as { data: SwapRequest | null; error: { message: string } | null };

      if (error || !data) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error?.message ?? 'Failed to cancel request',
        });
      }

      return data;
    }),
});
