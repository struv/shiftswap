import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import { User, UserSession } from '@/types/database';

/**
 * Server-side auth guard for protected pages and server actions.
 * Validates the session, fetches the user profile, and returns a UserSession.
 * Redirects to /auth/login if the user is not authenticated.
 */
export async function requireAuth(): Promise<UserSession> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Fetch user profile from the users table
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single() as { data: User | null };

  if (!profile) {
    // User exists in auth but not in users table — fallback to auth metadata
    return {
      id: user.id,
      email: user.email ?? '',
      name: user.user_metadata?.name ?? user.email?.split('@')[0] ?? '',
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
