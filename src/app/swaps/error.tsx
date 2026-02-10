'use client';

import { useEffect } from 'react';
import Link from 'next/link';

export default function SwapsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('Swaps error:', error);
  }, [error]);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-30 bg-surface/80 backdrop-blur-xl border-b border-border">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-4 flex items-center gap-3">
          <Link
            href="/dashboard"
            className="w-8 h-8 rounded-lg bg-surface-secondary border border-border-light flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-border transition-all"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="15 18 9 12 15 6" />
            </svg>
          </Link>
          <h1 className="text-lg font-bold text-text-primary tracking-tight">Swap Requests</h1>
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
            Failed to load swap requests
          </h2>
          <p className="text-sm text-text-secondary mb-6 leading-relaxed max-w-xs mx-auto">
            There was a problem loading the swap requests. This may be a temporary issue.
          </p>
          <div className="flex justify-center gap-3">
            <button
              onClick={reset}
              className="px-5 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              Retry
            </button>
            <Link
              href="/dashboard"
              className="px-5 py-2.5 bg-surface-secondary hover:bg-border text-text-primary rounded-xl text-sm font-semibold border border-border transition-all active:scale-[0.98]"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>
      </main>
    </div>
  );
}
