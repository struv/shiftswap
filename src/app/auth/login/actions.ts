'use server';

import { neonAuthSignIn } from '@/lib/neon-auth';
import { setSessionCookies } from '@/lib/session';

export async function loginAction(
  email: string,
  password: string
): Promise<{ error: string | null }> {
  const result = await neonAuthSignIn(email, password);

  if (result.error || !result.data) {
    return { error: result.error ?? 'Login failed' };
  }

  await setSessionCookies(
    result.data.tokens.access_token,
    result.data.tokens.refresh_token
  );

  return { error: null };
}
