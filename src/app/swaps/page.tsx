import { requireAuth } from '@/lib/auth';
import Link from 'next/link';
import { SwapRequestsList } from './SwapRequestsList';

export const dynamic = 'force-dynamic';

export default async function SwapsPage() {
  const session = await requireAuth();

  const isManager = session.role === 'manager' || session.role === 'admin';

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-gray-500 hover:text-gray-700">
              &larr;
            </Link>
            <h1 className="text-2xl font-bold text-gray-900">Swap Requests</h1>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/schedule"
              className="text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              Schedule
            </Link>
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

      <main className="max-w-7xl mx-auto px-4 py-6">
        <SwapRequestsList
          userId={session.id}
          isManager={isManager}
        />
      </main>
    </div>
  );
}
