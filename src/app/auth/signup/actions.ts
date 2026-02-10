'use server';

import { neonAuthSignUp } from '@/lib/neon-auth';
import { setSessionCookies } from '@/lib/session';

export async function signupAction(
  email: string,
  password: string,
  name: string
): Promise<{ error: string | null; needsConfirmation: boolean }> {
  const result = await neonAuthSignUp(email, password, name);

  if (result.error || !result.data) {
    return { error: result.error ?? 'Signup failed', needsConfirmation: false };
  }

  await setSessionCookies(
    result.data.tokens.access_token,
    result.data.tokens.refresh_token
  );

  return { error: null, needsConfirmation: false };
}
