import { router } from '../trpc';
import { notificationRouter } from './notification';

export const appRouter = router({
  notification: notificationRouter,
});

export type AppRouter = typeof appRouter;
