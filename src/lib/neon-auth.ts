/**
 * Neon Auth client.
 *
 * Communicates with the Neon Auth service at NEON_AUTH_BASE_URL
 * for user signup, signin, session validation, and signout.
 */

function getBaseUrl(): string {
  const url = process.env.NEON_AUTH_BASE_URL;
  if (!url) {
    throw new Error('NEON_AUTH_BASE_URL environment variable is not set');
  }
  return url.replace(/\/$/, '');
}

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

/**
 * Sign up a new user with email and password.
 */
export async function neonAuthSignUp(
  email: string,
  password: string,
  name?: string
): Promise<{ data: NeonAuthResult | null; error: string | null }> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/auth/password/sign-up`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, display_name: name }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        data: null,
        error: body.message ?? body.error ?? `Signup failed (${res.status})`,
      };
    }

    const body = await res.json();
    return {
      data: {
        user: {
          id: body.user_id ?? body.id,
          email,
          name: name ?? null,
        },
        tokens: {
          access_token: body.access_token,
          refresh_token: body.refresh_token,
        },
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
 */
export async function neonAuthSignIn(
  email: string,
  password: string
): Promise<{ data: NeonAuthResult | null; error: string | null }> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/auth/password/sign-in`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });

    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      return {
        data: null,
        error: body.message ?? body.error ?? 'Invalid login credentials',
      };
    }

    const body = await res.json();
    return {
      data: {
        user: {
          id: body.user_id ?? body.id,
          email: body.primary_email ?? body.email ?? email,
          name: body.display_name ?? body.name ?? null,
        },
        tokens: {
          access_token: body.access_token,
          refresh_token: body.refresh_token,
        },
      },
      error: null,
    };
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Login failed';
    return { data: null, error: message };
  }
}

/**
 * Validate a session by fetching the current user with the access token.
 * Returns the user if the token is valid, null otherwise.
 */
export async function neonAuthGetUser(
  accessToken: string
): Promise<NeonAuthUser | null> {
  try {
    const res = await fetch(`${getBaseUrl()}/api/v1/users/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!res.ok) return null;

    const body = await res.json();
    return {
      id: body.id ?? body.user_id,
      email: body.primary_email ?? body.email,
      name: body.display_name ?? body.name ?? null,
    };
  } catch {
    return null;
  }
}

/**
 * Refresh an access token using a refresh token.
 */
export async function neonAuthRefreshToken(
  refreshToken: string
): Promise<{ access_token: string } | null> {
  try {
    const res = await fetch(
      `${getBaseUrl()}/api/v1/auth/sessions/current/refresh`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      }
    );

    if (!res.ok) return null;

    const body = await res.json();
    return { access_token: body.access_token };
  } catch {
    return null;
  }
}

/**
 * Sign out — invalidate the current session.
 */
export async function neonAuthSignOut(accessToken: string): Promise<void> {
  try {
    await fetch(`${getBaseUrl()}/api/v1/auth/sessions/current`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    });
  } catch {
    // Best-effort signout; we always clear local cookies regardless
  }
}
