import { requireAuth } from '@/lib/auth';
import { createClient } from '@/lib/supabase/server';
import { Shift, User } from '@/types/database';
import { ScheduleCalendar } from './schedule-calendar';

export const dynamic = 'force-dynamic';

export default async function SchedulePage() {
  const session = await requireAuth();
  const supabase = await createClient();

  // Get current week's date range (Monday to Sunday)
  const now = new Date();
  const dayOfWeek = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);

  const startDate = monday.toISOString().split('T')[0];
  const endDate = sunday.toISOString().split('T')[0];

  // Fetch shifts for the current week with user details
  const { data: shifts } = await supabase
    .from('shifts')
    .select('*, user:users(id, name, email, role, department)')
    .gte('date', startDate)
    .lte('date', endDate)
    .order('date', { ascending: true })
    .order('start_time', { ascending: true }) as {
    data: (Shift & { user: Pick<User, 'id' | 'name' | 'email' | 'role' | 'department'> })[] | null;
  };

  // Get unique departments for filtering
  const departments = Array.from(
    new Set((shifts ?? []).map((s) => s.department).filter(Boolean))
  ).sort();

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 className="text-2xl font-bold text-gray-900">ShiftSwap</h1>
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

      <main className="max-w-7xl mx-auto px-4 py-8">
        <ScheduleCalendar
          initialShifts={shifts ?? []}
          departments={departments}
          currentUserId={session.id}
          userRole={session.role}
          initialStartDate={startDate}
        />
      </main>
    </div>
  );
}
