import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { SwapRequestsList } from './swap-requests-list';

export const dynamic = 'force-dynamic';

export default async function SwapsPage() {
  const session = await requireAuth();
  const supabase = await createClient();

  // Fetch swap requests with related data
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: swapRequests } = (await (supabase as any)
    .from('swap_requests')
    .select(
      '*, shift:shifts(id, date, start_time, end_time, role, department, user_id), requester:users!swap_requests_requested_by_fkey(id, name, email, role, department)'
    )
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .order('created_at', { ascending: false })) as { data: any[] | null };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">ShiftSwap</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">
              {session.name || session.email}
              <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                {session.role}
              </span>
            </span>
            <form action="/auth/logout" method="POST">
              <button
                type="submit"
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <SwapRequestsList
          initialRequests={swapRequests ?? []}
          currentUserId={session.id}
          userRole={session.role}
        />
      </main>
    </div>
  );
}
