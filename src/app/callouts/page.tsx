import { requireAuth } from '@/lib/auth';
import Link from 'next/link';
import { CallOutsList } from './CallOutsList';

export const dynamic = 'force-dynamic';

export default async function CalloutsPage() {
  const session = await requireAuth();

  return (
    <div className="min-h-screen bg-background">
      <header className="bg-surface border-b border-border sticky top-0 z-30 backdrop-blur-xl bg-surface/80">
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <Link
              href="/dashboard"
              className="w-8 h-8 rounded-lg bg-surface-secondary border border-border flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-border transition-all"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m15 18-6-6 6-6" />
              </svg>
            </Link>
            <h1 className="text-lg font-semibold tracking-tight text-text-primary">
              Open Call-Outs
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/callouts/new"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Post Call-Out
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
        <CallOutsList userId={session.id} />
      </main>
    </div>
  );
}
