/**
 * tRPC React Query client for client-side components.
 *
 * Usage in client components:
 *   import { trpc } from '@/lib/trpc';
 *   const { data } = trpc.notification.list.useQuery({ limit: 10 });
 */
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/routers/_app';

export const trpc = createTRPCReact<AppRouter>();
