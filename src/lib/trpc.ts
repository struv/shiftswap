/**
 * tRPC React client hooks.
 *
 * Import `trpc` from this module in client components to call tRPC endpoints:
 *
 * ```tsx
 * const { data } = trpc.notification.list.useQuery();
 * ```
 */
import { createTRPCReact } from '@trpc/react-query';
import type { AppRouter } from '@/server/routers/_app';

export const trpc = createTRPCReact<AppRouter>();
