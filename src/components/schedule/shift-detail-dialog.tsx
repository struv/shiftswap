"use client";

import { Shift, User, UserRole } from "@/types/database";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ShiftDetailDialogProps {
  shift: (Shift & { user?: User }) | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentUserId: string;
  userRole: UserRole;
  onRequestSwap: (shiftId: string) => void;
}

export function ShiftDetailDialog({
  shift,
  open,
  onOpenChange,
  currentUserId,
  userRole,
  onRequestSwap,
}: ShiftDetailDialogProps) {
  if (!shift) return null;

  const isOwnShift = shift.user_id === currentUserId;
  const isManager = userRole === "manager" || userRole === "admin";

  const dateStr = new Date(shift.date + "T00:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Shift Details</DialogTitle>
          <DialogDescription>{dateStr}</DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500">Time</p>
              <p className="font-medium">
                {shift.start_time.slice(0, 5)} - {shift.end_time.slice(0, 5)}
              </p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Role</p>
              <Badge variant="secondary" className="capitalize">
                {shift.role}
              </Badge>
            </div>
            <div>
              <p className="text-sm text-gray-500">Department</p>
              <p className="font-medium">{shift.department}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500">Assigned To</p>
              <p className="font-medium">{shift.user?.name || "Unassigned"}</p>
            </div>
          </div>

          <div className="flex gap-2 pt-2">
            {isOwnShift && (
              <Button
                variant="outline"
                className="w-full"
                onClick={() => {
                  onRequestSwap(shift.id);
                  onOpenChange(false);
                }}
              >
                Request Swap
              </Button>
            )}
            {isManager && (
              <Button variant="outline" className="w-full" disabled>
                Edit Shift
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
