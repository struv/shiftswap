'use client';

interface CalloutShift {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  role: string;
  department: string;
  location: { id: string; name: string } | null;
}

interface CalloutUser {
  id: string;
  name: string;
  email: string;
}

interface ClaimConfirmModalProps {
  shift: CalloutShift;
  callerUser: CalloutUser;
  reason: string | null;
  isClaiming: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

export function ClaimConfirmModal({
  shift,
  callerUser,
  reason,
  isClaiming,
  onConfirm,
  onCancel,
}: ClaimConfirmModalProps) {
  const shiftDate = new Date(shift.date + 'T00:00:00').toLocaleDateString(
    'en-US',
    { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' }
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-background/80 backdrop-blur-sm animate-fade-in"
        onClick={onCancel}
      />

      {/* Modal */}
      <div className="relative bg-surface border border-border rounded-[14px] shadow-[var(--shadow-xl)] w-full max-w-md mx-4 animate-scale-in">
        {/* Header */}
        <div className="px-6 pt-6 pb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center">
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-emerald-600"
              >
                <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
              </svg>
            </div>
            <div>
              <h3 className="text-base font-semibold text-text-primary">
                Claim this shift?
              </h3>
              <p className="text-sm text-text-secondary">
                Your claim will be sent to a manager for approval.
              </p>
            </div>
          </div>
        </div>

        {/* Shift details */}
        <div className="mx-6 p-4 bg-surface-secondary rounded-[10px] border border-border">
          <div className="space-y-2.5">
            {/* Who called out */}
            <div className="flex items-center gap-2">
              <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <span className="text-[9px] font-semibold text-rose-700">
                  {callerUser.name.charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm text-text-primary font-medium">
                {callerUser.name}
              </span>
              <span className="text-xs text-text-tertiary">called out</span>
            </div>

            {/* Date & time */}
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-text-tertiary shrink-0"
              >
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span className="font-medium">{shiftDate}</span>
            </div>

            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-text-tertiary shrink-0"
              >
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
            </div>

            {/* Role & department */}
            <div className="flex items-center gap-2 text-sm text-text-secondary">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-text-tertiary shrink-0"
              >
                <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
                <circle cx="9" cy="7" r="4" />
              </svg>
              <span className="capitalize">{shift.role}</span>
              <span className="text-text-tertiary">&middot;</span>
              {shift.department}
            </div>

            {/* Location */}
            {shift.location && (
              <div className="flex items-center gap-2 text-sm text-text-secondary">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-text-tertiary shrink-0"
                >
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                {shift.location.name}
              </div>
            )}

            {/* Reason */}
            {reason && (
              <div className="text-sm text-text-secondary pt-1 border-t border-border">
                <span className="font-medium text-text-primary">Reason:</span>{' '}
                {reason}
              </div>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="px-6 py-4 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isClaiming}
            className="flex-1 px-4 py-2.5 text-sm font-medium text-text-primary bg-transparent border border-border rounded-[6px] hover:bg-surface-secondary transition-all active:scale-[0.98] disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isClaiming}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-[6px] transition-all shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] active:scale-[0.98] disabled:bg-emerald-400"
          >
            {isClaiming ? (
              <>
                <svg
                  className="animate-spin h-3.5 w-3.5"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Claiming...
              </>
            ) : (
              "I'll take it"
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
