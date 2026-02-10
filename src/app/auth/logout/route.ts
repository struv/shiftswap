import { NextResponse } from 'next/server';
import { neonAuthSignOut } from '@/lib/neon-auth';
import { getSessionTokens, clearSessionCookies } from '@/lib/session';

export async function POST(request: Request) {
  const { accessToken } = await getSessionTokens();

  // Best-effort signout on the Neon Auth side
  if (accessToken) {
    await neonAuthSignOut(accessToken);
  }

  // Always clear local session cookies
  await clearSessionCookies();

  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/auth/login`, { status: 302 });
}
