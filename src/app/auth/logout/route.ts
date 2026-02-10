import { NextResponse } from 'next/server';
import { clearSessionCookies } from '@/lib/session';

export async function POST(request: Request) {
  await clearSessionCookies();

  const { origin } = new URL(request.url);
  return NextResponse.redirect(`${origin}/auth/login`, { status: 302 });
}
