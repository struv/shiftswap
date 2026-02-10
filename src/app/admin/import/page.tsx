import { requireAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CsvImport } from '@/components/CsvImport';

export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  const session = await requireAuth();

  if (session.role === 'staff') {
    redirect('/dashboard');
  }

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
            <h1 className="text-lg font-semibold tracking-tight text-text-primary">Import Shifts</h1>
          </div>
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
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 animate-fade-in-up">
        <div className="mb-8">
          <p className="text-sm text-text-secondary leading-relaxed max-w-2xl">
            Upload a CSV file to bulk-create shifts. You can map columns from
            legacy exports (e.g., When I Work) to our format.
          </p>
        </div>
        <CsvImport />
      </main>
    </div>
  );
}
