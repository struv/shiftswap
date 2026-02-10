'use client';

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/trpc/client';
import { ShiftDetailsModal } from './ShiftDetailsModal';
import { CreateShiftModal } from './CreateShiftModal';
import { SwapRequestModal } from './SwapRequestModal';

interface ShiftUser {
  id: string;
  name: string;
  email: string;
}

interface ShiftWithUser {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  role: string;
  department: string;
  created_at: string;
  user: ShiftUser | null;
}

interface WeeklyCalendarProps {
  userId: string;
  userRole: string;
  isManager: boolean;
}

const ROLE_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  cashier: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-800' },
  server: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-800' },
  cook: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-800' },
  manager: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-800' },
  host: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-800' },
  bartender: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-800' },
  default: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-800' },
};

function getRoleColor(role: string) {
  return ROLE_COLORS[role.toLowerCase()] ?? ROLE_COLORS.default;
}

function getWeekDates(baseDate: Date): Date[] {
  const dates: Date[] = [];
  const day = baseDate.getDay(); // 0 = Sunday
  const monday = new Date(baseDate);
  monday.setDate(baseDate.getDate() - ((day + 6) % 7));

  for (let i = 0; i < 7; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d);
  }
  return dates;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function WeeklyCalendar({ userId, userRole, isManager }: WeeklyCalendarProps) {
  const [currentDate, setCurrentDate] = useState(() => new Date());
  const [shifts, setShifts] = useState<ShiftWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [departmentFilter, setDepartmentFilter] = useState<string>('all');
  const [selectedShift, setSelectedShift] = useState<ShiftWithUser | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [swapShift, setSwapShift] = useState<ShiftWithUser | null>(null);

  const weekDates = getWeekDates(currentDate);
  const startDate = formatDate(weekDates[0]);
  const endDate = formatDate(weekDates[6]);

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await trpc.shift.list.query({ startDate, endDate });
      setShifts(result.shifts as ShiftWithUser[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load shifts');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  const navigateWeek = (direction: number) => {
    setCurrentDate((prev) => {
      const next = new Date(prev);
      next.setDate(prev.getDate() + direction * 7);
      return next;
    });
  };

  const goToToday = () => setCurrentDate(new Date());

  // Get unique departments for filtering
  const departments = Array.from(new Set(shifts.map((s) => s.department))).sort();

  const filteredShifts =
    departmentFilter === 'all'
      ? shifts
      : shifts.filter((s) => s.department === departmentFilter);

  // Group shifts by date
  const shiftsByDate: Record<string, ShiftWithUser[]> = {};
  for (const date of weekDates) {
    shiftsByDate[formatDate(date)] = [];
  }
  for (const shift of filteredShifts) {
    if (shiftsByDate[shift.date]) {
      shiftsByDate[shift.date].push(shift);
    }
  }

  const handleSwapRequest = (shift: ShiftWithUser) => {
    setSwapShift(shift);
    setShowSwapModal(true);
  };

  const weekLabel = `${weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`;

  return (
    <div>
      {/* Controls */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigateWeek(-1)}
            className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            aria-label="Previous week"
          >
            &larr;
          </button>
          <button
            onClick={goToToday}
            className="px-3 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium transition-colors"
          >
            Today
          </button>
          <button
            onClick={() => navigateWeek(1)}
            className="p-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            aria-label="Next week"
          >
            &rarr;
          </button>
          <span className="text-lg font-semibold text-gray-900 ml-2">
            {weekLabel}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {departments.length > 0 && (
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">All Departments</option>
              {departments.map((dept) => (
                <option key={dept} value={dept}>
                  {dept}
                </option>
              ))}
            </select>
          )}

          {isManager && (
            <button
              onClick={() => setShowCreateModal(true)}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors"
            >
              + Create Shift
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
          <button onClick={fetchShifts} className="ml-2 underline">
            Retry
          </button>
        </div>
      )}

      {/* Calendar grid */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {weekDates.map((date, i) => {
            const isToday = formatDate(date) === formatDate(new Date());
            return (
              <div
                key={i}
                className={`px-2 py-3 text-center border-r last:border-r-0 border-gray-200 ${
                  isToday ? 'bg-blue-50' : 'bg-gray-50'
                }`}
              >
                <div className="text-xs font-medium text-gray-500 uppercase">
                  {DAY_NAMES[i]}
                </div>
                <div
                  className={`text-lg font-semibold mt-1 ${
                    isToday ? 'text-blue-600' : 'text-gray-900'
                  }`}
                >
                  {date.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Shift cells */}
        {loading ? (
          <div className="grid grid-cols-7">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className="p-2 min-h-[200px] border-r last:border-r-0 border-gray-200"
              >
                <div className="space-y-2">
                  {[1, 2].map((j) => (
                    <div
                      key={j}
                      className="h-16 bg-gray-100 rounded animate-pulse"
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-7">
            {weekDates.map((date, i) => {
              const dateStr = formatDate(date);
              const dayShifts = shiftsByDate[dateStr] ?? [];
              const isToday = dateStr === formatDate(new Date());

              return (
                <div
                  key={i}
                  className={`p-2 min-h-[200px] border-r last:border-r-0 border-gray-200 ${
                    isToday ? 'bg-blue-50/30' : ''
                  }`}
                >
                  <div className="space-y-1.5">
                    {dayShifts.map((shift) => {
                      const colors = getRoleColor(shift.role);
                      const isOwn = shift.user_id === userId;

                      return (
                        <button
                          key={shift.id}
                          onClick={() => setSelectedShift(shift)}
                          className={`w-full text-left p-2 rounded border ${colors.bg} ${colors.border} hover:shadow-sm transition-shadow cursor-pointer ${
                            isOwn ? 'ring-2 ring-blue-400 ring-offset-1' : ''
                          }`}
                        >
                          <div className={`text-xs font-semibold ${colors.text}`}>
                            {formatTime(shift.start_time)} -{' '}
                            {formatTime(shift.end_time)}
                          </div>
                          <div className={`text-xs ${colors.text} font-medium mt-0.5`}>
                            {shift.role}
                          </div>
                          <div className="text-xs text-gray-600 truncate mt-0.5">
                            {shift.user?.name ?? 'Unassigned'}
                          </div>
                        </button>
                      );
                    })}
                    {dayShifts.length === 0 && (
                      <div className="text-xs text-gray-400 text-center py-4">
                        No shifts
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Role color legend */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <span className="text-xs text-gray-500 font-medium">Roles:</span>
        {Object.entries(ROLE_COLORS)
          .filter(([key]) => key !== 'default')
          .map(([role, colors]) => (
            <span
              key={role}
              className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}
            >
              {role.charAt(0).toUpperCase() + role.slice(1)}
            </span>
          ))}
      </div>

      {/* Shift details modal */}
      {selectedShift && (
        <ShiftDetailsModal
          shift={selectedShift}
          isOwn={selectedShift.user_id === userId}
          isManager={isManager}
          onClose={() => setSelectedShift(null)}
          onSwapRequest={() => {
            handleSwapRequest(selectedShift);
            setSelectedShift(null);
          }}
        />
      )}

      {/* Create shift modal (manager only) */}
      {showCreateModal && (
        <CreateShiftModal
          defaultDate={formatDate(weekDates[0])}
          onClose={() => setShowCreateModal(false)}
          onCreated={() => {
            setShowCreateModal(false);
            fetchShifts();
          }}
        />
      )}

      {/* Swap request modal */}
      {showSwapModal && swapShift && (
        <SwapRequestModal
          shift={swapShift}
          onClose={() => {
            setShowSwapModal(false);
            setSwapShift(null);
          }}
          onCreated={() => {
            setShowSwapModal(false);
            setSwapShift(null);
            fetchShifts();
          }}
        />
      )}
    </div>
  );
}
