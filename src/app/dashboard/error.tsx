'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Dashboard error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-sm">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 3l5 5-5 5" /><path d="M21 8H9" /><path d="M8 21l-5-5 5-5" /><path d="M3 16h12" />
            </svg>
          </div>
          <span className="text-lg font-bold text-text-primary tracking-tight">ShiftSwap</span>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8">
        <div className="bg-surface rounded-2xl border border-border p-10 text-center animate-fade-in-up">
          <div className="w-14 h-14 rounded-2xl bg-red-50 border border-red-100 flex items-center justify-center mx-auto mb-5">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-red-500">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-text-primary mb-2">
            Failed to load dashboard
          </h2>
          <p className="text-sm text-text-secondary mb-6 leading-relaxed max-w-xs mx-auto">
            There was a problem loading your dashboard data. This may be a temporary issue.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={reset}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              Retry
            </button>
            <Link
              href="/"
              className="px-5 py-2.5 bg-surface-secondary hover:bg-border text-text-primary rounded-xl text-sm font-semibold border border-border transition-all active:scale-[0.98]"
            >
              Go home
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
