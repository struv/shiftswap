/**
 * Shift CRUD router.
 *
 * Provides list (with date range filtering), create, update, and delete
 * endpoints. Write operations are restricted to managers/admins.
 * Server-side validation prevents overlapping shifts per user.
 */
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, orgProcedure } from '../trpc';

/**
 * Checks whether a proposed shift overlaps with any existing shift
 * for the same user on the same date. Returns true if overlap found.
 */
async function hasOverlappingShift(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  userId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludeShiftId?: string
): Promise<boolean> {
  let query = supabase
    .from('shifts')
    .select('id')
    .eq('user_id', userId)
    .eq('date', date)
    .lt('start_time', endTime)
    .gt('end_time', startTime);

  if (excludeShiftId) {
    query = query.neq('id', excludeShiftId);
  }

  const { data } = await query;
  return (data ?? []).length > 0;
}

export const shiftRouter = router({
  /** List shifts with optional date range and user filtering */
  list: orgProcedure
    .input(
      z.object({
        startDate: z.string().optional(),
        endDate: z.string().optional(),
        date: z.string().optional(),
        userId: z.string().uuid().optional(),
      })
    )
    .query(async ({ ctx, input }) => {
      let query = ctx.supabase.from('shifts').select('*, user:users(id, name, email)');

      if (input.date) {
        query = query.eq('date', input.date);
      }
      if (input.startDate) {
        query = query.gte('date', input.startDate);
      }
      if (input.endDate) {
        query = query.lte('date', input.endDate);
      }
      if (input.userId) {
        query = query.eq('user_id', input.userId);
      }

      query = query.order('date').order('start_time');

      const { data: shifts, error } = await query;
      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch shifts: ${error.message}`,
        });
      }
      return { shifts: shifts ?? [] };
    }),

  /** Create a new shift — manager/admin only */
  create: orgProcedure
    .input(
      z.object({
        userId: z.string().uuid(),
        date: z.string(), // YYYY-MM-DD
        startTime: z.string(), // HH:MM or HH:MM:SS
        endTime: z.string(),
        role: z.string(),
        department: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.orgRole === 'staff') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only managers and admins can create shifts',
        });
      }

      // Validate: end_time must be after start_time
      if (input.startTime >= input.endTime) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'End time must be after start time',
        });
      }

      // Validate: no overlapping shifts for this user on this date
      const overlap = await hasOverlappingShift(
        ctx.supabase,
        input.userId,
        input.date,
        input.startTime,
        input.endTime
      );
      if (overlap) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This shift overlaps with an existing shift for the user',
        });
      }

      const { data: shift, error } = await ctx.supabase
        .from('shifts')
        .insert({
          user_id: input.userId,
          date: input.date,
          start_time: input.startTime,
          end_time: input.endTime,
          role: input.role,
          department: input.department,
        })
        .select()
        .single();

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to create shift: ${error.message}`,
        });
      }

      return { shift };
    }),

  /** Update an existing shift — manager/admin only */
  update: orgProcedure
    .input(
      z.object({
        id: z.string().uuid(),
        userId: z.string().uuid().optional(),
        date: z.string().optional(),
        startTime: z.string().optional(),
        endTime: z.string().optional(),
        role: z.string().optional(),
        department: z.string().optional(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.orgRole === 'staff') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only managers and admins can update shifts',
        });
      }

      // Fetch the existing shift
      const { data: existing, error: fetchError } = await ctx.supabase
        .from('shifts')
        .select('*')
        .eq('id', input.id)
        .single();

      if (fetchError || !existing) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Shift not found',
        });
      }

      const updatedUserId = input.userId ?? existing.user_id;
      const updatedDate = input.date ?? existing.date;
      const updatedStartTime = input.startTime ?? existing.start_time;
      const updatedEndTime = input.endTime ?? existing.end_time;

      // Validate: end_time must be after start_time
      if (updatedStartTime >= updatedEndTime) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'End time must be after start time',
        });
      }

      // Validate: no overlapping shifts (exclude current shift)
      const overlap = await hasOverlappingShift(
        ctx.supabase,
        updatedUserId,
        updatedDate,
        updatedStartTime,
        updatedEndTime,
        input.id
      );
      if (overlap) {
        throw new TRPCError({
          code: 'CONFLICT',
          message: 'This shift overlaps with an existing shift for the user',
        });
      }

      // Build update payload (only include provided fields)
      const updateData: Record<string, string> = {};
      if (input.userId !== undefined) updateData.user_id = input.userId;
      if (input.date !== undefined) updateData.date = input.date;
      if (input.startTime !== undefined) updateData.start_time = input.startTime;
      if (input.endTime !== undefined) updateData.end_time = input.endTime;
      if (input.role !== undefined) updateData.role = input.role;
      if (input.department !== undefined) updateData.department = input.department;

      const { data: shift, error } = await ctx.supabase
        .from('shifts')
        .update(updateData)
        .eq('id', input.id)
        .select()
        .single();

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to update shift: ${error.message}`,
        });
      }

      return { shift };
    }),

  /** Delete a shift — manager/admin only */
  delete: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      if (ctx.orgRole === 'staff') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only managers and admins can delete shifts',
        });
      }

      const { error } = await ctx.supabase
        .from('shifts')
        .delete()
        .eq('id', input.id);

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to delete shift: ${error.message}`,
        });
      }

      return { success: true };
    }),
});
