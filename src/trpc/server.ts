import { createTRPCContext } from '@/server/trpc';
import { appRouter } from '@/server/routers/_app';
import { createCallerFactory } from '@/server/trpc';

const createCaller = createCallerFactory(appRouter);

/**
 * Server-side tRPC caller. Use in Server Components to call
 * tRPC procedures directly without an HTTP round-trip.
 */
export async function getServerCaller() {
  const ctx = await createTRPCContext({} as Parameters<typeof createTRPCContext>[0]);
  return createCaller(ctx);
}
