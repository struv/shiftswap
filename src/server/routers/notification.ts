/**
 * Notification tRPC router.
 *
 * Provides endpoints for listing, reading, and managing notifications.
 * All endpoints are org-scoped via orgProcedure middleware.
 */
import { z } from 'zod';
import { router, orgProcedure } from '../trpc';

export const notificationRouter = router({
  /**
   * List notifications for the current user.
   * Returns unread + recent read (last 10) by default.
   * Pass unreadOnly=true to get only unread notifications.
   */
  list: orgProcedure
    .input(
      z
        .object({
          unreadOnly: z.boolean().optional(),
        })
        .optional(),
    )
    .query(async ({ ctx, input }) => {
      let query = ctx.supabase
        .from('notifications')
        .select('*')
        .eq('user_id', ctx.user.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (input?.unreadOnly) {
        query = query.is('read_at', null);
      }

      const { data: notifications } = await query;

      // Get unread count separately for the badge
      const { count: unreadCount } = await ctx.supabase
        .from('notifications')
        .select('*', { count: 'exact', head: true })
        .eq('user_id', ctx.user.id)
        .is('read_at', null);

      return {
        notifications: notifications ?? [],
        unreadCount: unreadCount ?? 0,
      };
    }),

  /**
   * Mark a single notification as read.
   */
  markRead: orgProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await ctx.supabase
        .from('notifications')
        .update({ read_at: new Date().toISOString() })
        .eq('id', input.id)
        .eq('user_id', ctx.user.id);

      if (error) {
        throw new Error(`Failed to mark notification as read: ${error.message}`);
      }

      return { success: true };
    }),

  /**
   * Mark all notifications as read for the current user.
   */
  markAllRead: orgProcedure.mutation(async ({ ctx }) => {
    const { error } = await ctx.supabase
      .from('notifications')
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', ctx.user.id)
      .is('read_at', null);

    if (error) {
      throw new Error(`Failed to mark all notifications as read: ${error.message}`);
    }

    return { success: true };
  }),
});
