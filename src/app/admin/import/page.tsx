import { requireAuth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { CsvImport } from '@/components/CsvImport';

export const dynamic = 'force-dynamic';

export default async function ImportPage() {
  const session = await requireAuth();

  // Only managers and admins can import shifts
  if (session.role === 'staff') {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
              &larr; Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Import Shifts</h1>
          </div>
          <span className="text-gray-600">
            {session.name || session.email}
            <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
              {session.role}
            </span>
          </span>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <p className="text-gray-600">
            Upload a CSV file to bulk-create shifts. You can map columns from
            legacy exports (e.g., When I Work) to our format.
          </p>
        </div>
        <CsvImport />
      </main>
    </div>
  );
}
