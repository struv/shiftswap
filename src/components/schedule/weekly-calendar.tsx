"use client";

import { useState, useMemo } from "react";
import { Shift, User, UserRole } from "@/types/database";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShiftCard } from "./shift-card";
import { ShiftDetailDialog } from "./shift-detail-dialog";
import { ChevronLeft, ChevronRight } from "lucide-react";

type ShiftWithUser = Shift & { user?: User };

interface WeeklyCalendarProps {
  shifts: ShiftWithUser[];
  currentUserId: string;
  userRole: UserRole;
  departments: string[];
}

const HOURS = Array.from({ length: 19 }, (_, i) => i + 6); // 6am to 12am (midnight)

function getWeekDates(baseDate: Date): Date[] {
  const day = baseDate.getDay(); // 0=Sun
  const sunday = new Date(baseDate);
  sunday.setDate(baseDate.getDate() - day);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(sunday);
    d.setDate(sunday.getDate() + i);
    return d;
  });
}

function formatDateKey(date: Date): string {
  return date.toISOString().split("T")[0];
}

function parseTime(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h + m / 60;
}

export function WeeklyCalendar({
  shifts,
  currentUserId,
  userRole,
  departments,
}: WeeklyCalendarProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [selectedDepartment, setSelectedDepartment] = useState<string>("all");
  const [selectedShift, setSelectedShift] = useState<ShiftWithUser | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const weekDates = useMemo(() => getWeekDates(currentDate), [currentDate]);

  const filteredShifts = useMemo(() => {
    return shifts.filter((s) => {
      if (selectedDepartment !== "all" && s.department !== selectedDepartment) {
        return false;
      }
      return true;
    });
  }, [shifts, selectedDepartment]);

  // Group shifts by date
  const shiftsByDate = useMemo(() => {
    const map: Record<string, ShiftWithUser[]> = {};
    for (const shift of filteredShifts) {
      if (!map[shift.date]) map[shift.date] = [];
      map[shift.date].push(shift);
    }
    // Sort each day's shifts by start_time
    for (const key of Object.keys(map)) {
      map[key].sort((a, b) => parseTime(a.start_time) - parseTime(b.start_time));
    }
    return map;
  }, [filteredShifts]);

  function navigateWeek(direction: number) {
    const newDate = new Date(currentDate);
    newDate.setDate(currentDate.getDate() + direction * 7);
    setCurrentDate(newDate);
  }

  function goToToday() {
    setCurrentDate(new Date());
  }

  function handleShiftClick(shift: ShiftWithUser) {
    setSelectedShift(shift);
    setDialogOpen(true);
  }

  function handleRequestSwap(shiftId: string) {
    window.location.href = `/swaps/new?shift=${shiftId}`;
  }

  const isManager = userRole === "manager" || userRole === "admin";
  const todayKey = formatDateKey(new Date());

  const weekRange = `${weekDates[0].toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  })} - ${weekDates[6].toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  })}`;

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => navigateWeek(-1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Today
          </Button>
          <Button variant="outline" size="icon" onClick={() => navigateWeek(1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
          <h2 className="text-lg font-semibold ml-2">{weekRange}</h2>
        </div>

        <div className="flex items-center gap-2">
          <Select value={selectedDepartment} onValueChange={setSelectedDepartment}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Departments" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Departments</SelectItem>
              {departments.map((dept) => (
                <SelectItem key={dept} value={dept}>
                  {dept}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {isManager && (
            <Button onClick={() => (window.location.href = "/schedule/create")}>
              Create Shift
            </Button>
          )}
        </div>
      </div>

      {/* Calendar grid */}
      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* Day headers */}
        <div className="grid grid-cols-7 bg-gray-50 border-b border-gray-200">
          {weekDates.map((date) => {
            const dateKey = formatDateKey(date);
            const isToday = dateKey === todayKey;
            return (
              <div
                key={dateKey}
                className={`px-2 py-3 text-center border-r border-gray-200 last:border-r-0 ${
                  isToday ? "bg-blue-50" : ""
                }`}
              >
                <div className="text-xs text-gray-500 uppercase">
                  {date.toLocaleDateString("en-US", { weekday: "short" })}
                </div>
                <div
                  className={`text-sm font-semibold mt-1 ${
                    isToday
                      ? "bg-blue-600 text-white rounded-full w-7 h-7 flex items-center justify-center mx-auto"
                      : ""
                  }`}
                >
                  {date.getDate()}
                </div>
              </div>
            );
          })}
        </div>

        {/* Shifts by day */}
        <div className="grid grid-cols-7 min-h-[400px]">
          {weekDates.map((date) => {
            const dateKey = formatDateKey(date);
            const dayShifts = shiftsByDate[dateKey] || [];
            const isToday = dateKey === todayKey;

            return (
              <div
                key={dateKey}
                className={`border-r border-gray-200 last:border-r-0 p-1.5 space-y-1.5 ${
                  isToday ? "bg-blue-50/30" : ""
                }`}
              >
                {dayShifts.map((shift) => (
                  <ShiftCard
                    key={shift.id}
                    shift={shift}
                    onClick={handleShiftClick}
                  />
                ))}
                {dayShifts.length === 0 && (
                  <div className="text-xs text-gray-300 text-center mt-4">
                    No shifts
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Shift detail dialog */}
      <ShiftDetailDialog
        shift={selectedShift}
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        currentUserId={currentUserId}
        userRole={userRole}
        onRequestSwap={handleRequestSwap}
      />
    </div>
  );
}
