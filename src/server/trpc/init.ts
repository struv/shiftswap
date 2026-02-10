import { initTRPC, TRPCError } from '@trpc/server';
import superjson from 'superjson';
import type { Context } from './context';

const t = initTRPC.context<Context>().create({
  transformer: superjson,
});

export const router = t.router;
export const publicProcedure = t.procedure;

/** Requires an authenticated user */
export const protectedProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user || !ctx.profile) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in',
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      profile: ctx.profile,
    },
  });
});

/** Requires manager or admin role */
export const managerProcedure = t.procedure.use(async ({ ctx, next }) => {
  if (!ctx.user || !ctx.profile) {
    throw new TRPCError({
      code: 'UNAUTHORIZED',
      message: 'You must be logged in',
    });
  }
  if (ctx.profile.role !== 'manager' && ctx.profile.role !== 'admin') {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'Manager or admin role required',
    });
  }
  return next({
    ctx: {
      ...ctx,
      user: ctx.user,
      profile: ctx.profile,
    },
  });
});
