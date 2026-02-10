import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { User, Shift, SwapRequest, UserRole } from "@/types/database";
import { SwapRequestList } from "@/components/swaps/swap-request-list";

export const dynamic = "force-dynamic";

export default async function SwapsPage() {
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

  const isManager =
    profile?.role === "manager" || profile?.role === "admin";

  // Get swap requests - if manager, get all; if staff, get own
  let swapQuery = supabase
    .from("swap_requests")
    .select("*")
    .order("created_at", { ascending: false });

  if (!isManager) {
    swapQuery = swapQuery.eq("requester_id", user.id);
  }

  const { data: swapRequests } = (await swapQuery) as {
    data: SwapRequest[] | null;
  };

  // Get related shifts and users
  const shiftIds = [
    ...new Set((swapRequests || []).map((r) => r.shift_id)),
  ];
  const userIds = [
    ...new Set([
      ...(swapRequests || []).map((r) => r.requester_id),
      ...(swapRequests || [])
        .map((r) => r.reviewed_by)
        .filter(Boolean) as string[],
    ]),
  ];

  const { data: shifts } = shiftIds.length
    ? ((await supabase
        .from("shifts")
        .select("*")
        .in("id", shiftIds)) as { data: Shift[] | null })
    : { data: [] as Shift[] };

  const { data: users } = userIds.length
    ? ((await supabase
        .from("users")
        .select("*")
        .in("id", userIds)) as { data: User[] | null })
    : { data: [] as User[] };

  const shiftMap = new Map<string, Shift>();
  (shifts || []).forEach((s) => shiftMap.set(s.id, s));

  const userMap = new Map<string, User>();
  (users || []).forEach((u) => userMap.set(u.id, u));

  // Build the enriched request list
  const requestsWithDetails = (swapRequests || [])
    .filter((r) => shiftMap.has(r.shift_id) && userMap.has(r.requester_id))
    .map((r) => ({
      ...r,
      shift: shiftMap.get(r.shift_id)!,
      requester: userMap.get(r.requester_id)!,
      reviewer: r.reviewed_by ? userMap.get(r.reviewed_by) : undefined,
    }));

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
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Schedule
              </Link>
              <Link
                href="/swaps"
                className="text-sm text-gray-900 font-medium border-b-2 border-blue-600 pb-1"
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
      <main className="max-w-4xl mx-auto px-4 py-6">
        <SwapRequestList
          requests={requestsWithDetails}
          currentUserId={user.id}
          userRole={(profile?.role as UserRole) || "staff"}
        />
      </main>
    </div>
  );
}
