import { requireAuth } from '@/lib/auth';
import { createDbClient } from '@/lib/db-client';
import Link from 'next/link';
import { Shift } from '@/types/database';
import { NotificationBell } from '@/components/NotificationBell';

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await requireAuth();
  const db = createDbClient();

  const { count: openCallouts } = await db
    .from('callouts')
    .select('*', { count: 'exact', head: true })
    .eq('status', 'open');

  const today = new Date().toISOString().split('T')[0];
  const { data: upcomingShifts } = await db
    .from('shifts')
    .select('*')
    .eq('user_id', session.id)
    .gte('date', today)
    .order('date', { ascending: true })
    .limit(5) as { data: Shift[] | null };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="bg-surface border-b border-border sticky top-0 z-30 backdrop-blur-xl bg-surface/80">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M16 3l5 5-5 5" />
                <path d="M21 8H9" />
                <path d="M8 21l-5-5 5-5" />
                <path d="M3 16h12" />
              </svg>
            </div>
            <h1 className="text-lg font-semibold tracking-tight text-text-primary">ShiftSwap</h1>
          </div>
          <div className="flex items-center gap-4">
            <NotificationBell />
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-full bg-brand-100 flex items-center justify-center">
                <span className="text-xs font-semibold text-brand-700">
                  {(session.name || session.email || '?').charAt(0).toUpperCase()}
                </span>
              </div>
              <div className="hidden sm:block">
                <span className="text-sm font-medium text-text-primary">
                  {session.name || session.email}
                </span>
                <span className="ml-2 px-2 py-0.5 text-[11px] font-medium bg-brand-50 text-brand-700 border border-brand-200 rounded-full">
                  {session.role}
                </span>
              </div>
            </div>
            <form action="/auth/logout" method="POST">
              <button
                type="submit"
                className="text-sm text-text-tertiary hover:text-text-primary transition-colors"
              >
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-6 py-8 animate-fade-in-up">
        {/* Greeting */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-text-primary tracking-tight">
            {getGreeting()}, {session.name?.split(' ')[0] || 'there'}
          </h2>
          <p className="text-sm text-text-secondary mt-1">
            Here&apos;s what&apos;s happening with your shifts today.
          </p>
        </div>

        {/* Quick actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 mb-10">
          <Link
            href="/callouts/new"
            className="group relative overflow-hidden bg-gradient-to-br from-rose-500 to-rose-600 text-white rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:shadow-rose-500/20 hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div className="text-lg font-semibold">I Can&apos;t Work</div>
              <div className="text-sm text-white/80 mt-0.5">Post a call-out</div>
            </div>
          </Link>

          <Link
            href="/callouts"
            className="group relative overflow-hidden bg-gradient-to-br from-emerald-500 to-emerald-600 text-white rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/20 hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                  <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                </svg>
              </div>
              <div className="text-lg font-semibold">Pick Up Shift</div>
              <div className="text-sm text-white/80 mt-0.5">
                {openCallouts || 0} open call-out{(openCallouts || 0) !== 1 ? 's' : ''}
              </div>
            </div>
          </Link>

          <Link
            href="/schedule"
            className="group relative overflow-hidden bg-gradient-to-br from-brand-500 to-brand-600 text-white rounded-2xl p-6 transition-all duration-300 hover:shadow-lg hover:shadow-brand-500/20 hover:-translate-y-0.5 active:scale-[0.98]"
          >
            <div className="absolute top-0 right-0 w-24 h-24 bg-white/10 rounded-full -translate-y-8 translate-x-8" />
            <div className="relative">
              <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                  <line x1="16" y1="2" x2="16" y2="6" />
                  <line x1="8" y1="2" x2="8" y2="6" />
                  <line x1="3" y1="10" x2="21" y2="10" />
                </svg>
              </div>
              <div className="text-lg font-semibold">Schedule</div>
              <div className="text-sm text-white/80 mt-0.5">View weekly schedule</div>
            </div>
          </Link>
        </div>

        {/* Upcoming shifts */}
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="px-6 py-5 border-b border-border-light">
            <h2 className="text-base font-semibold text-text-primary flex items-center gap-2">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Upcoming Shifts
            </h2>
          </div>

          <div className="divide-y divide-border-light">
            {upcomingShifts && upcomingShifts.length > 0 ? (
              upcomingShifts.map((shift, i) => (
                <div
                  key={shift.id}
                  className={`flex justify-between items-center px-6 py-4 hover:bg-surface-secondary/50 transition-colors animate-fade-in-up stagger-${i + 1}`}
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center">
                      <span className="text-xs font-bold text-brand-600">
                        {new Date(shift.date).getDate()}
                      </span>
                    </div>
                    <div>
                      <div className="text-sm font-medium text-text-primary">
                        {new Date(shift.date).toLocaleDateString('en-US', {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                      <div className="text-xs text-text-secondary mt-0.5">
                        {shift.start_time} - {shift.end_time} &middot; {shift.role}
                      </div>
                    </div>
                  </div>
                  <Link
                    href={`/callouts/new?shift=${shift.id}`}
                    className="text-xs font-medium text-rose-600 hover:text-rose-700 px-3 py-1.5 rounded-lg hover:bg-rose-50 transition-all"
                  >
                    Can&apos;t work?
                  </Link>
                </div>
              ))
            ) : (
              <div className="px-6 py-12 text-center">
                <div className="w-12 h-12 rounded-full bg-surface-secondary flex items-center justify-center mx-auto mb-3">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary">
                    <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                    <line x1="16" y1="2" x2="16" y2="6" />
                    <line x1="8" y1="2" x2="8" y2="6" />
                    <line x1="3" y1="10" x2="21" y2="10" />
                  </svg>
                </div>
                <p className="text-sm text-text-tertiary">No upcoming shifts scheduled.</p>
              </div>
            )}
          </div>
        </div>

        {/* Manager section */}
        {session.role === 'manager' || session.role === 'admin' ? (
          <div className="mt-8 bg-surface border border-amber-200 rounded-2xl overflow-hidden animate-fade-in-up">
            <div className="px-6 py-5 border-b border-amber-100 bg-amber-50/50">
              <h2 className="text-base font-semibold text-amber-900 flex items-center gap-2">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-600">
                  <path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
                  <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1Z" />
                </svg>
                Manager Actions
              </h2>
            </div>
            <div className="p-6 flex flex-wrap gap-3">
              <Link
                href="/swaps"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 3l5 5-5 5" />
                  <path d="M21 8H9" />
                  <path d="M8 21l-5-5 5-5" />
                  <path d="M3 16h12" />
                </svg>
                Swap Requests
              </Link>
              <Link
                href="/admin/import"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="17 8 12 3 7 8" />
                  <line x1="12" y1="3" x2="12" y2="15" />
                </svg>
                Import Shifts
              </Link>
              <Link
                href="/admin/users"
                className="inline-flex items-center gap-2 px-4 py-2.5 bg-surface-secondary hover:bg-border text-text-primary rounded-xl text-sm font-medium border border-border transition-all duration-200 active:scale-[0.98]"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
                  <circle cx="9" cy="7" r="4" />
                  <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
                  <path d="M16 3.13a4 4 0 0 1 0 7.75" />
                </svg>
                Manage Users
              </Link>
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
}

function getGreeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
