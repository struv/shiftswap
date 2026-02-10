import { appRouter } from '@/server/routers/_app';
import { createTRPCContext } from '@/server/trpc';

export async function createCaller() {
  const ctx = await createTRPCContext();
  return appRouter.createCaller(ctx);
}
