import { requireAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import CSVImporter from '@/components/CSVImporter';

export const dynamic = 'force-dynamic';

export default async function ShiftImportPage() {
  const session = await requireAuth();

  // Only managers and admins can import shifts
  if (session.role === 'staff') {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-2xl font-bold text-gray-900">
              ShiftSwap
            </Link>
            <span className="text-gray-300">/</span>
            <h1 className="text-lg font-semibold text-gray-700">Import Shifts</h1>
          </div>
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

      {/* Main content */}
      <main className="max-w-4xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-bold text-gray-900">
            CSV Shift Import
          </h2>
          <p className="text-gray-600 mt-1">
            Upload a CSV file to bulk-create shifts. Supports When I Work export format.
          </p>
        </div>

        <CSVImporter />
      </main>
    </div>
  );
}
