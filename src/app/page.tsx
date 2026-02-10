import Link from 'next/link';
import { getAuthUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const dynamic = 'force-dynamic';

export default async function Home() {
  const user = await getAuthUser();

  // If logged in, redirect to dashboard
  if (user) {
    redirect('/dashboard');
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      <div className="max-w-4xl mx-auto px-4 py-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            ShiftSwap
          </h1>
          <p className="text-xl text-gray-600 mb-8">
            Same-day shift coverage made simple.
            <br />
            Post a call-out. Get it covered. Done.
          </p>
          <div className="flex justify-center gap-4">
            <Link
              href="/auth/login"
              className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
            >
              Sign In
            </Link>
            <Link
              href="/auth/signup"
              className="bg-white hover:bg-gray-50 text-gray-800 px-6 py-3 rounded-lg font-medium border border-gray-300 transition-colors"
            >
              Create Account
            </Link>
          </div>
        </div>

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-8 mt-16">
          <div className="text-center p-6">
            <div className="text-4xl mb-4">🚨</div>
            <h3 className="text-lg font-semibold mb-2">Post a Call-Out</h3>
            <p className="text-gray-600">
              Can&apos;t make your shift? Post it in seconds and notify available staff.
            </p>
          </div>
          <div className="text-center p-6">
            <div className="text-4xl mb-4">✋</div>
            <h3 className="text-lg font-semibold mb-2">Claim Shifts</h3>
            <p className="text-gray-600">
              See available shifts and claim them instantly. First come, first served.
            </p>
          </div>
          <div className="text-center p-6">
            <div className="text-4xl mb-4">✅</div>
            <h3 className="text-lg font-semibold mb-2">Quick Approval</h3>
            <p className="text-gray-600">
              Managers approve swaps with one tap. Everyone gets notified.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-gray-500 text-sm mt-16">
          Built for teams who need shift coverage fast.
        </div>
      </div>
    </div>
  );
}
