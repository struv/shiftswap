import { TRPCError } from '@trpc/server';
import { OrgRole } from '@/types/database';
import { DbClient } from '@/lib/db-client';

export interface OrgContext {
  orgId: string;
  role: OrgRole;
}

// Simple in-memory cache for org context: userId -> { data, expiry }
const orgContextCache = new Map<string, { data: OrgContext; expiry: number }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

/**
 * Derives org context from user's membership in org_members table.
 * Returns the user's orgId and role within that org.
 * Throws FORBIDDEN if the user has no org membership.
 */
export async function getOrgContext(
  db: DbClient,
  userId: string
): Promise<OrgContext> {
  // Check cache first
  const cached = orgContextCache.get(userId);
  if (cached && cached.expiry > Date.now()) {
    return cached.data;
  }

  // Query org_members to find user's org membership
  const { data: membership, error } = await db
    .from('org_members')
    .select('*')
    .eq('user_id', userId)
    .limit(1)
    .single();

  if (error || !membership) {
    throw new TRPCError({
      code: 'FORBIDDEN',
      message: 'User is not a member of any organization',
    });
  }

  const orgContext: OrgContext = {
    orgId: membership.org_id,
    role: membership.role,
  };

  // Cache the result
  orgContextCache.set(userId, {
    data: orgContext,
    expiry: Date.now() + CACHE_TTL_MS,
  });

  return orgContext;
}

/**
 * Sets the PostgreSQL session variable for RLS org isolation.
 * Must be called within a transaction or at the start of a request.
 */
export async function setOrgSessionVar(
  db: DbClient,
  orgId: string
): Promise<void> {
  const { error } = await db.rpc('set_org_context', {
    org_id: orgId,
  });

  if (error) {
    throw new TRPCError({
      code: 'INTERNAL_SERVER_ERROR',
      message: `Failed to set org context: ${error.message}`,
    });
  }
}

/** Clears cached org context for a user (e.g., on role change) */
export function clearOrgContextCache(userId: string): void {
  orgContextCache.delete(userId);
}
