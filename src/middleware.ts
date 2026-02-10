import { NextResponse, type NextRequest } from 'next/server';
import { getSessionTokensFromRequest } from '@/lib/session';
import { neonAuthGetUser } from '@/lib/neon-auth';

const PROTECTED_PATHS = ['/dashboard', '/callouts', '/shifts', '/approve', '/admin', '/schedule', '/swaps'];
const AUTH_PATHS = ['/auth/login', '/auth/signup'];

export async function middleware(request: NextRequest) {
  const { accessToken } = getSessionTokensFromRequest(request);
  const pathname = request.nextUrl.pathname;

  // Check if the user has a valid session
  const user = accessToken ? await neonAuthGetUser(accessToken) : null;

  // Redirect unauthenticated users away from protected routes
  const isProtectedPath = PROTECTED_PATHS.some((path) =>
    pathname.startsWith(path)
  );

  if (!user && isProtectedPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/auth/login';
    return NextResponse.redirect(url);
  }

  // Redirect authenticated users away from auth pages to dashboard
  const isAuthPath = AUTH_PATHS.some((path) => pathname.startsWith(path));

  if (user && isAuthPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
