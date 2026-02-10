import { z } from 'zod';
import { router, protectedProcedure } from '../trpc';
import type { Notification } from '@/types/database';

export const notificationRouter = router({
  list: protectedProcedure
    .input(
      z.object({
        unreadOnly: z.boolean().optional().default(false),
        limit: z.number().min(1).max(50).optional().default(10),
      }).optional()
    )
    .query(async ({ ctx, input }) => {
      const options = input ?? { unreadOnly: false, limit: 10 };
      let query = (ctx.supabase
        .from('notifications') as any)
        .select('*')
        .eq('user_id', ctx.user.id)
        .order('created_at', { ascending: false })
        .limit(options.limit);

      if (options.unreadOnly) {
        query = query.is('read_at', null);
      }

      const { data, error } = await query as { data: Notification[] | null; error: any };
      if (error) throw error;
      return data ?? [];
    }),

  unreadCount: protectedProcedure.query(async ({ ctx }) => {
    const { count, error } = await (ctx.supabase
      .from('notifications') as any)
      .select('*', { count: 'exact', head: true })
      .eq('user_id', ctx.user.id)
      .is('read_at', null) as { count: number | null; error: any };

    if (error) throw error;
    return count ?? 0;
  }),

  markRead: protectedProcedure
    .input(z.object({ id: z.string().uuid() }))
    .mutation(async ({ ctx, input }) => {
      const { error } = await (ctx.supabase
        .from('notifications') as any)
        .update({ read_at: new Date().toISOString() })
        .eq('id', input.id)
        .eq('user_id', ctx.user.id);

      if (error) throw error;
      return { success: true };
    }),

  markAllRead: protectedProcedure.mutation(async ({ ctx }) => {
    const { error } = await (ctx.supabase
      .from('notifications') as any)
      .update({ read_at: new Date().toISOString() })
      .eq('user_id', ctx.user.id)
      .is('read_at', null);

    if (error) throw error;
    return { success: true };
  }),
});
