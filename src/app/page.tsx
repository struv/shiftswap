import Link from 'next/link';
import { getAuthUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getAuthUser();

  if (user) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Ambient gradient background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-[40%] -right-[20%] w-[70%] h-[70%] rounded-full bg-gradient-to-br from-brand-200/30 via-brand-300/20 to-transparent blur-3xl" />
        <div className="absolute -bottom-[30%] -left-[20%] w-[60%] h-[60%] rounded-full bg-gradient-to-tr from-indigo-200/20 via-purple-200/10 to-transparent blur-3xl" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 max-w-6xl mx-auto px-6 py-6 flex justify-between items-center animate-fade-in-down">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-500 to-brand-700 flex items-center justify-center shadow-md">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M16 3l5 5-5 5" />
              <path d="M21 8H9" />
              <path d="M8 21l-5-5 5-5" />
              <path d="M3 16h12" />
            </svg>
          </div>
          <span className="text-xl font-semibold tracking-tight text-text-primary">ShiftSwap</span>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/auth/login"
            className="text-sm font-medium text-text-secondary hover:text-text-primary transition-colors px-4 py-2"
          >
            Sign in
          </Link>
          <Link
            href="/auth/signup"
            className="text-sm font-medium bg-brand-600 hover:bg-brand-700 text-white px-5 py-2.5 rounded-xl transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
          >
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10 max-w-6xl mx-auto px-6 pt-20 pb-24 md:pt-32 md:pb-36">
        <div className="text-center max-w-3xl mx-auto animate-fade-in-up">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-brand-50 border border-brand-200 text-brand-700 text-sm font-medium mb-8">
            <span className="w-1.5 h-1.5 rounded-full bg-brand-500 animate-pulse-soft" />
            Built for teams that move fast
          </div>

          <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-text-primary leading-[1.1] mb-6">
            Shift coverage,
            <br />
            <span className="bg-gradient-to-r from-brand-600 via-brand-500 to-indigo-500 bg-clip-text text-transparent">
              simplified.
            </span>
          </h1>

          <p className="text-lg md:text-xl text-text-secondary max-w-xl mx-auto mb-10 leading-relaxed">
            Post a call-out. Get it covered. Done.
            <br className="hidden sm:block" />
            The fastest way for your team to manage shift swaps.
          </p>

          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link
              href="/auth/signup"
              className="inline-flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white px-8 py-3.5 rounded-2xl font-semibold text-base transition-all duration-200 shadow-lg shadow-brand-500/25 hover:shadow-xl hover:shadow-brand-500/30 active:scale-[0.98]"
            >
              Start Free
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
            <Link
              href="/auth/login"
              className="inline-flex items-center justify-center gap-2 bg-surface hover:bg-surface-secondary text-text-primary px-8 py-3.5 rounded-2xl font-semibold text-base border border-border transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              Sign In
            </Link>
          </div>
        </div>

        {/* Feature cards */}
        <div className="grid md:grid-cols-3 gap-6 mt-28 max-w-4xl mx-auto">
          <div className="animate-fade-in-up stagger-1 group bg-surface border border-border rounded-2xl p-7 transition-all duration-300 hover:shadow-lg hover:border-brand-200 hover:-translate-y-0.5">
            <div className="w-11 h-11 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E11D48" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-text-primary mb-2">Post a Call-Out</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Can&apos;t make your shift? Post it in seconds and notify your entire team instantly.
            </p>
          </div>

          <div className="animate-fade-in-up stagger-2 group bg-surface border border-border rounded-2xl p-7 transition-all duration-300 hover:shadow-lg hover:border-brand-200 hover:-translate-y-0.5">
            <div className="w-11 h-11 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-text-primary mb-2">Claim Shifts</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              See open shifts and claim them instantly. No phone calls, no group texts.
            </p>
          </div>

          <div className="animate-fade-in-up stagger-3 group bg-surface border border-border rounded-2xl p-7 transition-all duration-300 hover:shadow-lg hover:border-brand-200 hover:-translate-y-0.5">
            <div className="w-11 h-11 rounded-xl bg-brand-50 border border-brand-200 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#4F46E5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                <polyline points="22 4 12 14.01 9 11.01" />
              </svg>
            </div>
            <h3 className="text-base font-semibold text-text-primary mb-2">Quick Approval</h3>
            <p className="text-sm text-text-secondary leading-relaxed">
              Managers approve swaps with one click. Everyone gets notified automatically.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="relative z-10 text-center pb-10">
        <p className="text-sm text-text-tertiary">
          Built for teams who need shift coverage fast.
        </p>
      </footer>
    </div>
  );
}
