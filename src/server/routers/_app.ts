import { router } from '../trpc/init';
import { shiftRouter } from './shift';
import { swapRouter } from './swap';

export const appRouter = router({
  shift: shiftRouter,
  swap: swapRouter,
});

export type AppRouter = typeof appRouter;
