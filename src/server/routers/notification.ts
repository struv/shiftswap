/**
 * Notification router.
 *
 * Handles in-app notification CRUD:
 * - list: Get recent notifications (unread + recent read)
 * - unreadCount: Get count of unread notifications
 * - markRead: Mark a single notification as read
 * - markAllRead: Mark all unread notifications as read
 */
import { z } from 'zod';
import { TRPCError } from '@trpc/server';
import { router, orgProcedure } from '../trpc';

export const notificationRouter = router({
  /**
   * List notifications for the current user.
   * Returns last 10 notifications ordered by most recent first.
   */
  list: orgProcedure
    .input(
      z.object({
        limit: z.number().min(1).max(50).optional().default(10),
        unreadOnly: z.boolean().optional().default(false),
      })
    )
    .query(async ({ ctx, input }) => {
      let query = ctx.supabase
        .from('notifications')
        .select('*')
        .eq('user_id', ctx.user.id)
        .order('created_at', { ascending: false })
        .limit(input.limit);

      if (input.unreadOnly) {
        query = query.is('read_at', null);
      }

      const { data: notifications, error } = await query;

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to fetch notifications: ${error.message}`,
        });
      }

      return { notifications: notifications ?? [] };
    }),

  /**
   * Get the count of unread notifications for the current user.
   */
  unreadCount: orgProcedure.query(async ({ ctx }) => {
    const { count, error } = await ctx.supabase
      .from('notifications')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', ctx.user.id)
      .is('read_at', null);

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to fetch unread count: ${error.message}`,
      });
    }

    return { count: count ?? 0 };
  }),

  /**
   * Mark a single notification as read.
   */
  markRead: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      // Verify notification belongs to the user
      const { data: notification, error: fetchError } = await ctx.supabase
        .from('notifications')
        .select('id, user_id')
        .eq('id', input.id)
        .single();

      if (fetchError || !notification) {
        throw new TRPCError({
          code: 'NOT_FOUND',
          message: 'Notification not found',
        });
      }

      if (notification.user_id !== ctx.user.id) {
        throw new TRPCError({
          code: 'FORBIDDEN',
          message: 'You can only mark your own notifications as read',
        });
      }

      const { error } = await ctx.supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', input.id);

      if (error) {
        throw new TRPCError({
          code: 'INTERNAL_SERVER_ERROR',
          message: `Failed to mark notification as read: ${error.message}`,
        });
      }

      return { success: true };
    }),

  /**
   * Mark all unread notifications as read for the current user.
   */
  markAllRead: orgProcedure.mutation(async ({ ctx }) => {
    const { error } = await ctx.supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', ctx.user.id)
      .is('read_at', null);

    if (error) {
      throw new TRPCError({
        code: 'INTERNAL_SERVER_ERROR',
        message: `Failed to mark all notifications as read: ${error.message}`,
      });
    }

    return { success: true };
  }),
});
