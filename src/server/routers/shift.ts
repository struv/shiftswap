import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, protectedProcedure, managerProcedure } from '../trpc/init';
import type { Shift } from '@/types/database';

const TIME_REGEX = /^\d{2}:\d{2}$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const shiftCreateSchema = z.object({
  user_id: z.string().uuid(),
  date: z.string().regex(DATE_REGEX, 'Date must be YYYY-MM-DD'),
  start_time: z.string().regex(TIME_REGEX, 'Time must be HH:MM'),
  end_time: z.string().regex(TIME_REGEX, 'Time must be HH:MM'),
  role: z.string().min(1, 'Role is required'),
  department: z.string().min(1, 'Department is required'),
});

const shiftUpdateSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid().optional(),
  date: z.string().regex(DATE_REGEX, 'Date must be YYYY-MM-DD').optional(),
  start_time: z.string().regex(TIME_REGEX, 'Time must be HH:MM').optional(),
  end_time: z.string().regex(TIME_REGEX, 'Time must be HH:MM').optional(),
  role: z.string().min(1).optional(),
  department: z.string().min(1).optional(),
});

/** Check that start_time < end_time */
function validateTimeRange(start: string, end: string) {
  if (start >= end) {
    throw new TRPCError({
      code: 'BAD_REQUEST',
      message: 'start_time must be before end_time',
    });
  }
}

type ShiftTimeslot = Pick<Shift, 'id' | 'start_time' | 'end_time'>;

export const shiftRouter = router({
  /**
   * List shifts with optional filters.
   * Any authenticated user can list shifts.
   */
  list: protectedProcedure
    .input(
      z
        .object({
          department: z.string().optional(),
          startDate: z.string().regex(DATE_REGEX).optional(),
          endDate: z.string().regex(DATE_REGEX).optional(),
          userId: z.string().uuid().optional(),
        })
        .optional()
    )
    .query(async ({ ctx, input }) => {
      let query = ctx.supabase.from('shifts').select('*');

      if (input?.department) {
        query = query.eq('department', input.department);
      }
      if (input?.startDate) {
        query = query.gte('date', input.startDate);
      }
      if (input?.endDate) {
        query = query.lte('date', input.endDate);
      }
      if (input?.userId) {
        query = query.eq('user_id', input.userId);
      }

      query = query.order('date', { ascending: true }).order('start_time', { ascending: true });

      const { data, error } = (await query) as { data: Shift[] | null; error: { message: string } | null };

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }

      return data ?? [];
    }),

  /**
   * Create a new shift. Manager/admin only.
   * Validates no overlapping shifts for the same user on the same date.
   */
  create: managerProcedure.input(shiftCreateSchema).mutation(async ({ ctx, input }) => {
    validateTimeRange(input.start_time, input.end_time);

    // Check for overlapping shifts for this user on this date
    const { data: existing, error: checkError } = (await ctx.supabase
      .from('shifts')
      .select('id, start_time, end_time')
      .eq('user_id', input.user_id)
      .eq('date', input.date)) as { data: ShiftTimeslot[] | null; error: { message: string } | null };

    if (checkError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: checkError.message,
      });
    }

    const hasOverlap = (existing ?? []).some(
      (shift) => input.start_time < shift.end_time && input.end_time > shift.start_time
    );

    if (hasOverlap) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'This shift overlaps with an existing shift for the same user',
      });
    }

    const { data, error } = (await ctx.supabase
      .from('shifts')
      .insert({
        user_id: input.user_id,
        date: input.date,
        start_time: input.start_time,
        end_time: input.end_time,
        role: input.role,
        department: input.department,
      } as never)
      .select()
      .single()) as { data: Shift | null; error: { message: string } | null };

    if (error || !data) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error?.message ?? 'Failed to create shift',
      });
    }

    return data;
  }),

  /**
   * Update an existing shift. Manager/admin only.
   * Re-validates overlap if date or times change.
   */
  update: managerProcedure.input(shiftUpdateSchema).mutation(async ({ ctx, input }) => {
    const { id, ...updates } = input;

    // Fetch the existing shift
    const { data: existing, error: fetchError } = (await ctx.supabase
      .from('shifts')
      .select('*')
      .eq('id', id)
      .single()) as { data: Shift | null; error: { message: string } | null };

    if (fetchError || !existing) {
      throw new TRPCError({
        code: 'NOT_FOUND',
        message: 'Shift not found',
      });
    }

    const finalDate = updates.date ?? existing.date;
    const finalStart = updates.start_time ?? existing.start_time;
    const finalEnd = updates.end_time ?? existing.end_time;
    const finalUserId = updates.user_id ?? existing.user_id;

    validateTimeRange(finalStart, finalEnd);

    // Check for overlapping shifts (excluding this one)
    const { data: others, error: checkError } = (await ctx.supabase
      .from('shifts')
      .select('id, start_time, end_time')
      .eq('user_id', finalUserId)
      .eq('date', finalDate)
      .neq('id', id)) as { data: ShiftTimeslot[] | null; error: { message: string } | null };

    if (checkError) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: checkError.message,
      });
    }

    const hasOverlap = (others ?? []).some(
      (shift) => finalStart < shift.end_time && finalEnd > shift.start_time
    );

    if (hasOverlap) {
      throw new TRPCError({
        code: 'CONFLICT',
        message: 'Updated shift would overlap with an existing shift for the same user',
      });
    }

    const { data, error } = (await ctx.supabase
      .from('shifts')
      .update(updates as never)
      .eq('id', id)
      .select()
      .single()) as { data: Shift | null; error: { message: string } | null };

    if (error || !data) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: error?.message ?? 'Failed to update shift',
      });
    }

    return data;
  }),

  /**
   * Delete a shift. Manager/admin only.
   */
  delete: managerProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = (await ctx.supabase
        .from('shifts')
        .delete()
        .eq('id', input.id)) as { error: { message: string } | null };

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: error.message,
        });
      }

      return { success: true };
    }),
});
