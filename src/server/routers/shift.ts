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
  db: any,
  userId: string,
  date: string,
  startTime: string,
  endTime: string,
  excludeShiftId?: string
): Promise<boolean> {
  let query = db
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
      let query = ctx.db.from('shifts').select('*, user:users(id, name, email)');

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
        ctx.db,
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

      const { data: shift, error } = await ctx.db
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
      const { data: existing, error: fetchError } = await ctx.db
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
        ctx.db,
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

      const { data: shift, error } = await ctx.db
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

  /** Bulk create shifts from CSV import — manager/admin only */
  bulkCreate: orgProcedure
    .input(
      z.object({
        shifts: z.array(
          z.object({
            email: z.string().email(),
            date: z.string(),
            startTime: z.string(),
            endTime: z.string(),
            role: z.string(),
            department: z.string(),
          })
        ),
      })
    )
    .mutation(async ({ ctx, input }) => {
      if (ctx.orgRole === 'staff') {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'Only managers and admins can bulk create shifts',
        });
      }

      // Look up all unique emails to get user IDs
      const uniqueEmails = [...new Set(input.shifts.map((s) => s.email))];
      const { data: users, error: userError } = await ctx.db
        .from('users')
        .select('id, email')
        .in('email', uniqueEmails);

      if (userError) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to look up users: ${userError.message}`,
        });
      }

      const emailToId = new Map<string, string>();
      for (const user of users ?? []) {
        emailToId.set(user.email, user.id);
      }

      const created: Array<{ row: number }> = [];
      const failed: Array<{ row: number; email: string; error: string }> = [];

      for (let i = 0; i < input.shifts.length; i++) {
        const shift = input.shifts[i];
        const userId = emailToId.get(shift.email);

        if (!userId) {
          failed.push({ row: i + 1, email: shift.email, error: `User not found: ${shift.email}` });
          continue;
        }

        if (shift.startTime >= shift.endTime) {
          failed.push({ row: i + 1, email: shift.email, error: 'End time must be after start time' });
          continue;
        }

        const { error } = await ctx.db.from('shifts').insert({
          user_id: userId,
          date: shift.date,
          start_time: shift.startTime,
          end_time: shift.endTime,
          role: shift.role,
          department: shift.department,
        });

        if (error) {
          failed.push({ row: i + 1, email: shift.email, error: error.message });
        } else {
          created.push({ row: i + 1 });
        }
      }

      return { created: created.length, failed, total: input.shifts.length };
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

      const { error } = await ctx.db
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
