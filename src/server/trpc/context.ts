import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type { Database, User } from '@/types/database';

export async function createTRPCContext() {
  const cookieStore = await cookies();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  const supabase = createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          );
        } catch {
          // Called from Server Component - middleware handles session refresh
        }
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: User | null = null;
  if (user) {
    const { data } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single() as { data: User | null };
    profile = data;
  }

  return { supabase, user, profile };
}

export type Context = Awaited<ReturnType<typeof createTRPCContext>>;
