/**
 * Server-side session cookie management for Neon Auth.
 *
 * Stores access and refresh tokens in HTTP-only cookies.
 */
import { cookies } from 'next/headers';

const ACCESS_TOKEN_COOKIE = 'neon_access_token';
const REFRESH_TOKEN_COOKIE = 'neon_refresh_token';

const baseCookieOptions = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
};

export async function setSessionCookies(
  accessToken: string,
  refreshToken: string
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(ACCESS_TOKEN_COOKIE, accessToken, {
    ...baseCookieOptions,
    maxAge: 60 * 60, // 1 hour
  });
  cookieStore.set(REFRESH_TOKEN_COOKIE, refreshToken, {
    ...baseCookieOptions,
    maxAge: 60 * 60 * 24 * 7, // 7 days
  });
}

export async function getSessionTokens(): Promise<{
  accessToken: string | null;
  refreshToken: string | null;
}> {
  const cookieStore = await cookies();
  return {
    accessToken: cookieStore.get(ACCESS_TOKEN_COOKIE)?.value ?? null,
    refreshToken: cookieStore.get(REFRESH_TOKEN_COOKIE)?.value ?? null,
  };
}

export async function clearSessionCookies(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(ACCESS_TOKEN_COOKIE);
  cookieStore.delete(REFRESH_TOKEN_COOKIE);
}

/**
 * Read session tokens from a NextRequest (for middleware use).
 * Does not use next/headers — reads directly from request cookies.
 */
export function getSessionTokensFromRequest(request: {
  cookies: { get(name: string): { value: string } | undefined };
}): { accessToken: string | null; refreshToken: string | null } {
  return {
    accessToken: request.cookies.get(ACCESS_TOKEN_COOKIE)?.value ?? null,
    refreshToken: request.cookies.get(REFRESH_TOKEN_COOKIE)?.value ?? null,
  };
}
