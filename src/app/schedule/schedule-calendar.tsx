'use client';

import { useState, useMemo } from 'react';
import { ChevronLeft, ChevronRight, Plus, ArrowLeftRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Shift, User, UserRole } from '@/types/database';

type ShiftWithUser = Shift & {
  user: Pick<User, 'id' | 'name' | 'email' | 'role' | 'department'>;
};

interface ScheduleCalendarProps {
  initialShifts: ShiftWithUser[];
  departments: string[];
  currentUserId: string;
  userRole: UserRole;
  initialStartDate: string;
}

const ROLE_COLORS: Record<string, string> = {
  nurse: 'bg-blue-100 border-blue-300 text-blue-800',
  doctor: 'bg-purple-100 border-purple-300 text-purple-800',
  tech: 'bg-green-100 border-green-300 text-green-800',
  admin: 'bg-orange-100 border-orange-300 text-orange-800',
  receptionist: 'bg-pink-100 border-pink-300 text-pink-800',
  default: 'bg-gray-100 border-gray-300 text-gray-800',
};

const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function getWeekDates(startDate: string): Date[] {
  const start = new Date(startDate + 'T00:00:00');
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(start);
    d.setDate(start.getDate() + i);
    return d;
  });
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getRoleColor(role: string): string {
  return ROLE_COLORS[role.toLowerCase()] || ROLE_COLORS.default;
}

export function ScheduleCalendar({
  initialShifts,
  departments,
  currentUserId,
  userRole,
  initialStartDate,
}: ScheduleCalendarProps) {
  const [shifts, setShifts] = useState<ShiftWithUser[]>(initialShifts);
  const [weekStart, setWeekStart] = useState(initialStartDate);
  const [selectedDepartment, setSelectedDepartment] = useState('');
  const [selectedShift, setSelectedShift] = useState<ShiftWithUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const weekDates = useMemo(() => getWeekDates(weekStart), [weekStart]);
  const isManager = userRole === 'manager' || userRole === 'admin';

  const filteredShifts = useMemo(() => {
    if (!selectedDepartment) return shifts;
    return shifts.filter((s) => s.department === selectedDepartment);
  }, [shifts, selectedDepartment]);

  // Group shifts by date
  const shiftsByDate = useMemo(() => {
    const map = new Map<string, ShiftWithUser[]>();
    for (const date of weekDates) {
      map.set(formatDate(date), []);
    }
    for (const shift of filteredShifts) {
      const existing = map.get(shift.date);
      if (existing) {
        existing.push(shift);
      }
    }
    return map;
  }, [filteredShifts, weekDates]);

  async function navigateWeek(direction: number) {
    const start = new Date(weekStart + 'T00:00:00');
    start.setDate(start.getDate() + direction * 7);
    const newStart = formatDate(start);
    const newEnd = new Date(start);
    newEnd.setDate(start.getDate() + 6);

    setWeekStart(newStart);
    setIsLoading(true);

    try {
      const params = new URLSearchParams({
        startDate: newStart,
        endDate: formatDate(newEnd),
      });
      if (selectedDepartment) {
        params.set('department', selectedDepartment);
      }
      const res = await fetch(`/api/shifts?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setShifts(data.shifts ?? []);
      }
    } catch {
      // Keep existing shifts on error
    } finally {
      setIsLoading(false);
    }
  }

  function goToToday() {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const monday = new Date(now);
    monday.setDate(now.getDate() - (dayOfWeek === 0 ? 6 : dayOfWeek - 1));
    const newStart = formatDate(monday);

    if (newStart !== weekStart) {
      setWeekStart(newStart);
      // Refetch would happen via navigateWeek, but for today we reload
      window.location.href = '/schedule';
    }
  }

  const weekLabel = useMemo(() => {
    const start = weekDates[0];
    const end = weekDates[6];
    const startMonth = start.toLocaleDateString('en-US', { month: 'long' });
    const endMonth = end.toLocaleDateString('en-US', { month: 'long' });
    const year = end.getFullYear();
    if (startMonth === endMonth) {
      return `${startMonth} ${start.getDate()} - ${end.getDate()}, ${year}`;
    }
    return `${start.toLocaleDateString('en-US', { month: 'short' })} ${start.getDate()} - ${end.toLocaleDateString('en-US', { month: 'short' })} ${end.getDate()}, ${year}`;
  }, [weekDates]);

  return (
    <div>
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Schedule</h2>
          <p className="text-sm text-gray-500">{weekLabel}</p>
        </div>
        <div className="flex items-center gap-3">
          <Select
            options={departments.map((d) => ({ value: d, label: d }))}
            placeholder="All Departments"
            value={selectedDepartment}
            onChange={(e) => setSelectedDepartment(e.target.value)}
            className="w-44"
          />
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => navigateWeek(-1)} disabled={isLoading}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" size="icon" onClick={() => navigateWeek(1)} disabled={isLoading}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          {isManager && (
            <Button size="sm">
              <Plus className="h-4 w-4 mr-1" />
              Create Shift
            </Button>
          )}
        </div>
      </div>

      {/* Calendar grid */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 border-b border-gray-200">
          {weekDates.map((date, i) => {
            const isToday = formatDate(date) === formatDate(new Date());
            return (
              <div
                key={i}
                className={`px-2 py-3 text-center border-r border-gray-200 last:border-r-0 ${
                  isToday ? 'bg-blue-50' : ''
                }`}
              >
                <div className="text-xs font-medium text-gray-500 uppercase">
                  {DAY_NAMES[i]}
                </div>
                <div
                  className={`text-sm font-semibold mt-1 ${
                    isToday
                      ? 'bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mx-auto'
                      : 'text-gray-900'
                  }`}
                >
                  {date.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Shift cells */}
        <div className="grid grid-cols-7 min-h-[400px]">
          {weekDates.map((date, i) => {
            const dateStr = formatDate(date);
            const dayShifts = shiftsByDate.get(dateStr) ?? [];
            const isToday = dateStr === formatDate(new Date());

            return (
              <div
                key={i}
                className={`border-r border-gray-200 last:border-r-0 p-2 space-y-1.5 ${
                  isToday ? 'bg-blue-50/30' : ''
                }`}
              >
                {isLoading ? (
                  <div className="flex items-center justify-center h-20">
                    <div className="w-4 h-4 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  </div>
                ) : dayShifts.length === 0 ? (
                  <div className="text-xs text-gray-400 text-center py-4">
                    No shifts
                  </div>
                ) : (
                  dayShifts.map((shift) => (
                    <button
                      key={shift.id}
                      onClick={() => setSelectedShift(shift)}
                      className={`w-full text-left p-2 rounded-md border text-xs transition-shadow hover:shadow-md ${getRoleColor(
                        shift.role
                      )}`}
                    >
                      <div className="font-semibold truncate">
                        {shift.start_time} - {shift.end_time}
                      </div>
                      <div className="truncate">{shift.user?.name || 'Unassigned'}</div>
                      <div className="truncate opacity-75">{shift.role}</div>
                    </button>
                  ))
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Shift detail modal */}
      <Dialog open={!!selectedShift} onOpenChange={() => setSelectedShift(null)}>
        {selectedShift && (
          <DialogContent onClose={() => setSelectedShift(null)}>
            <DialogHeader>
              <DialogTitle>Shift Details</DialogTitle>
              <DialogDescription>
                {new Date(selectedShift.date + 'T00:00:00').toLocaleDateString('en-US', {
                  weekday: 'long',
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Time</label>
                  <p className="text-sm font-medium">
                    {selectedShift.start_time} - {selectedShift.end_time}
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Role</label>
                  <p className="text-sm">
                    <Badge variant="info">{selectedShift.role}</Badge>
                  </p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Department</label>
                  <p className="text-sm font-medium">{selectedShift.department}</p>
                </div>
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Assignee</label>
                  <p className="text-sm font-medium">
                    {selectedShift.user?.name || 'Unassigned'}
                  </p>
                </div>
              </div>

              {selectedShift.user?.email && (
                <div>
                  <label className="text-xs font-medium text-gray-500 uppercase">Email</label>
                  <p className="text-sm text-gray-600">{selectedShift.user.email}</p>
                </div>
              )}
            </div>

            <DialogFooter>
              {selectedShift.user_id === currentUserId && (
                <a
                  href={`/swaps?shiftId=${selectedShift.id}`}
                  className="inline-flex items-center justify-center h-8 rounded-md px-3 text-xs font-medium border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 transition-colors"
                >
                  <ArrowLeftRight className="h-4 w-4 mr-1" />
                  Request Swap
                </a>
              )}
              <Button variant="outline" size="sm" onClick={() => setSelectedShift(null)}>
                Close
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </div>
  );
}
