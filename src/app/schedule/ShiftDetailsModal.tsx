'use client';

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

interface ShiftDetailsModalProps {
  shift: ShiftWithUser;
  isOwn: boolean;
  isManager: boolean;
  onClose: () => void;
  onSwapRequest: () => void;
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

export function ShiftDetailsModal({
  shift,
  isOwn,
  isManager,
  onClose,
  onSwapRequest,
}: ShiftDetailsModalProps) {
  const shiftDate = new Date(shift.date + 'T00:00:00');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
      />
      <div className="relative bg-white rounded-xl shadow-xl max-w-md w-full mx-4 p-6">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400 hover:text-gray-600 text-xl"
          aria-label="Close"
        >
          &times;
        </button>

        <h2 className="text-lg font-semibold text-gray-900 mb-4">
          Shift Details
        </h2>

        <div className="space-y-3">
          <div className="flex justify-between items-start">
            <span className="text-sm text-gray-500">Date</span>
            <span className="text-sm font-medium text-gray-900">
              {shiftDate.toLocaleDateString('en-US', {
                weekday: 'long',
                month: 'long',
                day: 'numeric',
                year: 'numeric',
              })}
            </span>
          </div>

          <div className="flex justify-between items-start">
            <span className="text-sm text-gray-500">Time</span>
            <span className="text-sm font-medium text-gray-900">
              {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
            </span>
          </div>

          <div className="flex justify-between items-start">
            <span className="text-sm text-gray-500">Role</span>
            <span className="text-sm font-medium text-gray-900 capitalize">
              {shift.role}
            </span>
          </div>

          <div className="flex justify-between items-start">
            <span className="text-sm text-gray-500">Department</span>
            <span className="text-sm font-medium text-gray-900">
              {shift.department}
            </span>
          </div>

          <div className="flex justify-between items-start">
            <span className="text-sm text-gray-500">Assigned to</span>
            <span className="text-sm font-medium text-gray-900">
              {shift.user?.name ?? 'Unassigned'}
              {isOwn && (
                <span className="ml-1 text-xs text-blue-600">(You)</span>
              )}
            </span>
          </div>
        </div>

        <div className="mt-6 flex gap-3">
          {isOwn && !isManager && (
            <button
              onClick={onSwapRequest}
              className="flex-1 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
            >
              Request Swap
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 bg-gray-200 hover:bg-gray-300 text-gray-800 rounded-lg text-sm font-medium transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
