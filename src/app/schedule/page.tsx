import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { User, Shift, UserRole } from "@/types/database";
import { WeeklyCalendar } from "@/components/schedule/weekly-calendar";

export const dynamic = "force-dynamic";

export default async function SchedulePage() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth/login");
  }

  // Get user profile
  const { data: profile } = (await supabase
    .from("users")
    .select("*")
    .eq("id", user.id)
    .single()) as { data: User | null };

  // Get all shifts for the broader date range (4 weeks around today)
  const today = new Date();
  const rangeStart = new Date(today);
  rangeStart.setDate(today.getDate() - 14);
  const rangeEnd = new Date(today);
  rangeEnd.setDate(today.getDate() + 14);

  const { data: shifts } = (await supabase
    .from("shifts")
    .select("*")
    .gte("date", rangeStart.toISOString().split("T")[0])
    .lte("date", rangeEnd.toISOString().split("T")[0])
    .order("date", { ascending: true })) as { data: Shift[] | null };

  // Get all users for shift assignment display
  const { data: allUsers } = (await supabase
    .from("users")
    .select("*")) as { data: User[] | null };

  const userMap = new Map<string, User>();
  allUsers?.forEach((u) => userMap.set(u.id, u));

  // Attach user info to shifts
  const shiftsWithUsers = (shifts || []).map((shift) => ({
    ...shift,
    user: userMap.get(shift.user_id),
  }));

  // Get unique departments
  const departments = [
    ...new Set((shifts || []).map((s) => s.department).filter(Boolean)),
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 py-4 flex justify-between items-center">
          <div className="flex items-center gap-6">
            <Link href="/dashboard" className="text-2xl font-bold text-gray-900">
              ShiftSwap
            </Link>
            <nav className="hidden md:flex items-center gap-4">
              <Link
                href="/dashboard"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Dashboard
              </Link>
              <Link
                href="/schedule"
                className="text-sm text-gray-900 font-medium border-b-2 border-blue-600 pb-1"
              >
                Schedule
              </Link>
              <Link
                href="/swaps"
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Swap Requests
              </Link>
            </nav>
          </div>
          <div className="flex items-center gap-4">
            <span className="text-gray-600 text-sm">
              {profile?.name || user.email}
              {profile?.role && (
                <span className="ml-2 px-2 py-1 text-xs bg-blue-100 text-blue-800 rounded">
                  {profile.role}
                </span>
              )}
            </span>
          </div>
        </div>
      </header>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <WeeklyCalendar
          shifts={shiftsWithUsers}
          currentUserId={user.id}
          userRole={(profile?.role as UserRole) || "staff"}
          departments={departments}
        />
      </main>
    </div>
  );
}
