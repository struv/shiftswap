/**
 * Custom JWT authentication backed by Neon Postgres.
 *
 * Replaces the previous external Neon Auth API calls with direct
 * database queries, bcrypt password hashing, and JWT token generation.
 */

import { query } from '@/lib/db';
import { hashPassword, verifyPassword } from '@/lib/password';
import { signAccessToken, signRefreshToken, verifyToken } from '@/lib/jwt';

export interface NeonAuthUser {
  id: string;
  email: string;
  name: string | null;
}

export interface NeonAuthTokens {
  access_token: string;
  refresh_token: string;
}

export interface NeonAuthResult {
  user: NeonAuthUser;
  tokens: NeonAuthTokens;
}

// Default org ID for new signups (single-tenant MVP)
const DEFAULT_ORG_ID = '00000000-0000-0000-0000-000000000000';

/**
 * Sign up a new user with email and password.
 * Hashes the password with bcrypt, inserts into the users table,
 * and returns JWT tokens.
 */
export async function neonAuthSignUp(
  email: string,
  password: string,
  name?: string
): Promise<{ data: NeonAuthResult | null; error: string | null }> {
  try {
    if (password.length < 6) {
      return { data: null, error: 'Password should be at least 6 characters' };
    }

    // Check if email already exists
    const existing = await query(
      'SELECT id FROM users WHERE email = $1 LIMIT 1',
      [email]
    );
    if (existing.rows.length > 0) {
      return { data: null, error: 'An account with this email already exists' };
    }

    const passwordHash = await hashPassword(password);
    const displayName = name ?? email.split('@')[0];

    // Ensure default org exists
    await query(
      `INSERT INTO organizations (id, name, slug)
       VALUES ($1, 'Default', 'default')
       ON CONFLICT (id) DO NOTHING`,
      [DEFAULT_ORG_ID]
    );

    const { rows } = await query(
      `INSERT INTO users (org_id, email, password_hash, name)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, name`,
      [DEFAULT_ORG_ID, email, passwordHash, displayName]
    );

    const user = rows[0];
    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(user.id, user.email),
      signRefreshToken(user.id, user.email),
    ]);

    return {
      data: {
        user: { id: user.id, email: user.email, name: user.name },
        tokens: { access_token: accessToken, refresh_token: refreshToken },
      },
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Signup failed';
    return { data: null, error: message };
  }
}

/**
 * Sign in with email and password.
 * Verifies the password with bcrypt, then returns JWT tokens.
 */
export async function neonAuthSignIn(
  email: string,
  password: string
): Promise<{ data: NeonAuthResult | null; error: string | null }> {
  try {
    const { rows } = await query(
      'SELECT id, email, name, password_hash FROM users WHERE email = $1 LIMIT 1',
      [email]
    );

    if (rows.length === 0) {
      return { data: null, error: 'Invalid login credentials' };
    }

    const user = rows[0];
    const valid = await verifyPassword(password, user.password_hash);
    if (!valid) {
      return { data: null, error: 'Invalid login credentials' };
    }

    const [accessToken, refreshToken] = await Promise.all([
      signAccessToken(user.id, user.email),
      signRefreshToken(user.id, user.email),
    ]);

    return {
      data: {
        user: { id: user.id, email: user.email, name: user.name },
        tokens: { access_token: accessToken, refresh_token: refreshToken },
      },
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Login failed';
    return { data: null, error: message };
  }
}

/**
 * Validate a session by verifying the JWT access token.
 * Returns the user if the token is valid, null otherwise.
 */
export async function neonAuthGetUser(
  accessToken: string
): Promise<NeonAuthUser | null> {
  const payload = await verifyToken(accessToken);
  if (!payload || payload.type !== 'access') return null;

  return {
    id: payload.sub!,
    email: payload.email,
    name: null, // Caller fetches full profile from DB if needed
  };
}

/**
 * Refresh an access token using a refresh token.
 * Validates the refresh JWT and issues a new access token (token rotation).
 */
export async function neonAuthRefreshToken(
  refreshToken: string
): Promise<{ access_token: string; refresh_token: string } | null> {
  const payload = await verifyToken(refreshToken);
  if (!payload || payload.type !== 'refresh') return null;

  const [newAccess, newRefresh] = await Promise.all([
    signAccessToken(payload.sub!, payload.email),
    signRefreshToken(payload.sub!, payload.email),
  ]);

  return { access_token: newAccess, refresh_token: newRefresh };
}

/**
 * Sign out — no server-side action needed with stateless JWTs.
 * The caller clears the HTTP-only cookies.
 */
export async function neonAuthSignOut(_accessToken: string): Promise<void> {
  // Stateless JWT: nothing to invalidate server-side.
  // Session cookies are cleared by the caller.
}
