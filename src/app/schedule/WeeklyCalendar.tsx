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

const ROLE_COLORS: Record<string, { bg: string; border: string; text: string; dot: string }> = {
  cashier: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700', dot: 'bg-blue-400' },
  server: { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  cook: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700', dot: 'bg-orange-400' },
  manager: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700', dot: 'bg-purple-400' },
  host: { bg: 'bg-pink-50', border: 'border-pink-200', text: 'text-pink-700', dot: 'bg-pink-400' },
  bartender: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700', dot: 'bg-amber-400' },
  default: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700', dot: 'bg-gray-400' },
};

function getRoleColor(role: string) {
  return ROLE_COLORS[role.toLowerCase()] ?? ROLE_COLORS.default;
}

function getWeekDates(baseDate: Date): Date[] {
  const dates: Date[] = [];
  const day = baseDate.getDay();
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

  const departments = Array.from(new Set(shifts.map((s) => s.department))).sort();

  const filteredShifts =
    departmentFilter === 'all'
      ? shifts
      : shifts.filter((s) => s.department === departmentFilter);

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
        <div className="flex items-center gap-2">
          <button
            onClick={() => navigateWeek(-1)}
            className="w-9 h-9 flex items-center justify-center bg-surface border border-border rounded-xl hover:bg-surface-secondary transition-all active:scale-95"
            aria-label="Previous week"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary">
              <path d="m15 18-6-6 6-6" />
            </svg>
          </button>
          <button
            onClick={goToToday}
            className="px-3.5 h-9 bg-surface border border-border rounded-xl hover:bg-surface-secondary text-sm font-medium text-text-primary transition-all active:scale-95"
          >
            Today
          </button>
          <button
            onClick={() => navigateWeek(1)}
            className="w-9 h-9 flex items-center justify-center bg-surface border border-border rounded-xl hover:bg-surface-secondary transition-all active:scale-95"
            aria-label="Next week"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary">
              <path d="m9 18 6-6-6-6" />
            </svg>
          </button>
          <span className="text-base font-semibold text-text-primary ml-2">
            {weekLabel}
          </span>
        </div>

        <div className="flex items-center gap-3">
          {departments.length > 0 && (
            <select
              value={departmentFilter}
              onChange={(e) => setDepartmentFilter(e.target.value)}
              className="px-3.5 h-9 bg-surface border border-border rounded-xl text-sm text-text-primary transition-all focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400"
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
              className="inline-flex items-center gap-1.5 px-4 h-9 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19" />
                <line x1="5" y1="12" x2="19" y2="12" />
              </svg>
              Create Shift
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2 animate-fade-in-down">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
          <button onClick={fetchShifts} className="ml-auto text-red-800 underline text-xs font-medium">
            Retry
          </button>
        </div>
      )}

      {/* Calendar grid */}
      <div className="bg-surface rounded-2xl border border-border overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-border">
          {weekDates.map((date, i) => {
            const isToday = formatDate(date) === formatDate(new Date());
            return (
              <div
                key={i}
                className={`px-2 py-3.5 text-center border-r last:border-r-0 border-border-light ${
                  isToday ? 'bg-brand-50/50' : 'bg-surface-secondary/50'
                }`}
              >
                <div className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wider">
                  {DAY_NAMES[i]}
                </div>
                <div
                  className={`text-lg font-semibold mt-0.5 ${
                    isToday ? 'text-brand-600' : 'text-text-primary'
                  }`}
                >
                  {isToday ? (
                    <span className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-brand-600 text-white text-sm">
                      {date.getDate()}
                    </span>
                  ) : (
                    date.getDate()
                  )}
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
                className="p-2.5 min-h-[200px] border-r last:border-r-0 border-border-light"
              >
                <div className="space-y-2">
                  {[1, 2].map((j) => (
                    <div
                      key={j}
                      className="h-16 rounded-xl animate-shimmer"
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
                  className={`p-2.5 min-h-[200px] border-r last:border-r-0 border-border-light ${
                    isToday ? 'bg-brand-50/20' : ''
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
                          className={`w-full text-left p-2.5 rounded-xl border ${colors.bg} ${colors.border} hover:shadow-sm transition-all duration-200 cursor-pointer active:scale-[0.98] ${
                            isOwn ? 'ring-2 ring-brand-400/50 ring-offset-1' : ''
                          }`}
                        >
                          <div className="flex items-center gap-1.5 mb-1">
                            <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
                            <span className={`text-[11px] font-semibold ${colors.text}`}>
                              {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                            </span>
                          </div>
                          <div className={`text-xs ${colors.text} font-medium`}>
                            {shift.role}
                          </div>
                          <div className="text-[11px] text-text-secondary truncate mt-0.5">
                            {shift.user?.name ?? 'Unassigned'}
                          </div>
                        </button>
                      );
                    })}
                    {dayShifts.length === 0 && (
                      <div className="text-xs text-text-tertiary text-center py-8">
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
      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <span className="text-xs text-text-tertiary font-medium">Roles:</span>
        {Object.entries(ROLE_COLORS)
          .filter(([key]) => key !== 'default')
          .map(([role, colors]) => (
            <span
              key={role}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium ${colors.bg} ${colors.text} border ${colors.border}`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${colors.dot}`} />
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
