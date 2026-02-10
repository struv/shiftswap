"use client";

import { Shift, User } from "@/types/database";
import { cn } from "@/lib/utils";

// Role color mapping
const roleColors: Record<string, string> = {
  bartender: "bg-purple-100 border-purple-300 text-purple-900",
  server: "bg-blue-100 border-blue-300 text-blue-900",
  host: "bg-green-100 border-green-300 text-green-900",
  cook: "bg-orange-100 border-orange-300 text-orange-900",
  manager: "bg-red-100 border-red-300 text-red-900",
  cashier: "bg-teal-100 border-teal-300 text-teal-900",
  default: "bg-gray-100 border-gray-300 text-gray-900",
};

function getRoleColor(role: string): string {
  return roleColors[role.toLowerCase()] || roleColors.default;
}

interface ShiftCardProps {
  shift: Shift & { user?: User };
  onClick: (shift: Shift & { user?: User }) => void;
  compact?: boolean;
}

export function ShiftCard({ shift, onClick, compact }: ShiftCardProps) {
  const colorClass = getRoleColor(shift.role);

  return (
    <button
      onClick={() => onClick(shift)}
      className={cn(
        "w-full text-left rounded-md border p-1.5 text-xs transition-all hover:shadow-md cursor-pointer",
        colorClass,
        compact ? "p-1" : "p-1.5"
      )}
    >
      <div className="font-semibold truncate">
        {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
      </div>
      <div className="truncate capitalize">{shift.role}</div>
      {shift.user && !compact && (
        <div className="truncate text-[10px] opacity-75">
          {shift.user.name}
        </div>
      )}
    </button>
  );
}
