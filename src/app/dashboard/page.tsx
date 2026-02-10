import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import type { User, Shift } from '@/types/database';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const supabase = await createClient();

  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/auth/login');
  }

  // Get user profile
  const { data: profile } = await supabase
    .from('users')
    .select('*')
    .eq('id', user.id)
    .single() as { data: User | null };

  // Get pending swap requests count
  const { count: pendingSwaps } = await supabase
    .from('swap_requests')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'pending');

  // Get user's upcoming shifts
  const now = new Date().toISOString();
  const { data: upcomingShifts } = await supabase
    .from('shifts')
    .select('*')
    .eq('user_id', user.id)
    .gte('start_time', now)
    .order('start_time', { ascending: true })
    .limit(5) as { data: Shift[] | null };

  const handleSignOut = async () => {
    'use server';
    const supabase = await createClient();
    await supabase.auth.signOut();
    redirect('/auth/login');
  };

  const displayName = profile
    ? `${profile.firstName} ${profile.lastName}`
    : user.email;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">ShiftSwap</h1>
          <div className="flex items-center gap-4">
            <span className="text-gray-600">
              {displayName}
              {profile?.role && (
                <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                  {profile.role}
                </span>
              )}
            </span>
            <form action={handleSignOut}>
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

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          <Link
            href="/swap/new"
            className="bg-red-500 hover:bg-red-600 text-white rounded-lg p-6 text-center transition-colors"
          >
            <div className="text-3xl mb-2">🔄</div>
            <div className="text-xl font-semibold">Request Swap</div>
            <div className="text-sm opacity-90">Swap a shift with someone</div>
          </Link>

          <Link
            href="/swaps"
            className="bg-green-500 hover:bg-green-600 text-white rounded-lg p-6 text-center transition-colors"
          >
            <div className="text-3xl mb-2">📋</div>
            <div className="text-xl font-semibold">Swap Requests</div>
            <div className="text-sm opacity-90">
              {pendingSwaps || 0} pending requests
            </div>
          </Link>

          <Link
            href="/shifts"
            className="bg-blue-500 hover:bg-blue-600 text-white rounded-lg p-6 text-center transition-colors"
          >
            <div className="text-3xl mb-2">📅</div>
            <div className="text-xl font-semibold">My Shifts</div>
            <div className="text-sm opacity-90">View your schedule</div>
          </Link>
        </div>

        {/* Upcoming shifts */}
        <div className="bg-white rounded-lg shadow p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            Your Upcoming Shifts
          </h2>

          {upcomingShifts && upcomingShifts.length > 0 ? (
            <div className="space-y-3">
              {upcomingShifts.map((shift) => (
                <div
                  key={shift.id}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg"
                >
                  <div>
                    <div className="font-medium">
                      {new Date(shift.startTime).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </div>
                    <div className="text-sm text-gray-600">
                      {new Date(shift.startTime).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                      {' - '}
                      {new Date(shift.endTime).toLocaleTimeString('en-US', {
                        hour: 'numeric',
                        minute: '2-digit',
                      })}
                      {shift.role && ` • ${shift.role}`}
                    </div>
                  </div>
                  <Link
                    href={`/swap/new?shift=${shift.id}`}
                    className="text-sm text-red-600 hover:text-red-700"
                  >
                    Request swap
                  </Link>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-500">No upcoming shifts scheduled.</p>
          )}
        </div>

        {/* Manager section */}
        {profile?.role === 'manager' || profile?.role === 'admin' ? (
          <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-6">
            <h2 className="text-lg font-semibold text-yellow-800 mb-4">
              Manager Actions
            </h2>
            <div className="flex gap-4">
              <Link
                href="/approve"
                className="bg-yellow-500 hover:bg-yellow-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Pending Approvals
              </Link>
              <Link
                href="/admin/users"
                className="bg-gray-500 hover:bg-gray-600 text-white px-4 py-2 rounded-lg transition-colors"
              >
                Manage Users
              </Link>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}
