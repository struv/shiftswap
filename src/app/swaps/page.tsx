import { requireAuth } from '@/lib/auth';
import Link from 'next/link';
import { SwapRequestsList } from './SwapRequestsList';

export const dynamic = 'force-dynamic';

export default async function SwapsPage() {
  const session = await requireAuth();

  const isManager = session.role === 'manager' || session.role === 'admin';

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-surface border-b border-border sticky top-0 z-30 backdrop-blur-xl bg-surface/80">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="w-8 h-8 rounded-lg bg-surface-secondary border border-border flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-border transition-all">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
            <h1 className="text-lg font-semibold tracking-tight text-text-primary">Swap Requests</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/schedule"
              className="text-sm font-medium text-brand-600 hover:text-brand-700 transition-colors"
            >
              Schedule
            </Link>
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

      <main className="max-w-7xl mx-auto px-6 py-6 animate-fade-in-up">
        <SwapRequestsList
          userId={session.id}
          isManager={isManager}
        />
      </main>
    </div>
  );
}
