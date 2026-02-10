import { redirect } from 'next/navigation';
import { UserSession } from '@/types/database';
import { neonAuthGetUser, neonAuthRefreshToken } from '@/lib/neon-auth';
import { getSessionTokens, setSessionCookies } from '@/lib/session';
import { query } from '@/lib/db';

/**
 * Server-side auth guard for protected pages and server actions.
 * Validates the Neon Auth session token, fetches the user profile,
 * and returns a UserSession. Redirects to /auth/login if not authenticated.
 */
export async function requireAuth(): Promise<UserSession> {
  const { accessToken, refreshToken } = await getSessionTokens();

  if (!accessToken) {
    redirect('/auth/login');
  }

  // Validate the access token
  let authUser = await neonAuthGetUser(accessToken);

  // If token expired, try refreshing
  if (!authUser && refreshToken) {
    const refreshed = await neonAuthRefreshToken(refreshToken);
    if (refreshed) {
      await setSessionCookies(refreshed.access_token, refreshToken);
      authUser = await neonAuthGetUser(refreshed.access_token);
    }
  }

  if (!authUser) {
    redirect('/auth/login');
  }

  // Fetch user profile from the users table
  const { rows } = await query(
    'SELECT * FROM users WHERE id = $1 LIMIT 1',
    [authUser.id]
  );
  const profile = rows[0] ?? null;

  if (!profile) {
    // User exists in auth but not in users table — fallback to auth metadata
    return {
      id: authUser.id,
      email: authUser.email,
      name: authUser.name ?? authUser.email.split('@')[0],
      role: 'staff',
      department: null,
    };
  }

  return {
    id: profile.id,
    email: profile.email,
    name: profile.name,
    role: profile.role,
    department: profile.department,
  };
}

/**
 * Get the current auth user without redirecting (returns null if not authenticated).
 */
export async function getAuthUser(): Promise<{ id: string; email: string } | null> {
  const { accessToken, refreshToken } = await getSessionTokens();

  if (!accessToken) return null;

  let authUser = await neonAuthGetUser(accessToken);

  if (!authUser && refreshToken) {
    const refreshed = await neonAuthRefreshToken(refreshToken);
    if (refreshed) {
      await setSessionCookies(refreshed.access_token, refreshToken);
      authUser = await neonAuthGetUser(refreshed.access_token);
    }
  }

  if (!authUser) return null;

  return { id: authUser.id, email: authUser.email };
}
