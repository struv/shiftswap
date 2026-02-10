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
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      <div
        className="absolute inset-0 bg-black/30 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative bg-surface rounded-2xl shadow-xl max-w-md w-full mx-4 p-7 border border-border animate-scale-in">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 w-8 h-8 rounded-lg bg-surface-secondary border border-border-light flex items-center justify-center text-text-tertiary hover:text-text-primary hover:bg-border transition-all"
          aria-label="Close"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <h2 className="text-lg font-semibold text-text-primary mb-5">
          Shift Details
        </h2>

        <div className="space-y-4">
          <DetailRow label="Date">
            {shiftDate.toLocaleDateString('en-US', {
              weekday: 'long',
              month: 'long',
              day: 'numeric',
              year: 'numeric',
            })}
          </DetailRow>

          <DetailRow label="Time">
            {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
          </DetailRow>

          <DetailRow label="Role">
            <span className="capitalize">{shift.role}</span>
          </DetailRow>

          <DetailRow label="Department">
            {shift.department}
          </DetailRow>

          <DetailRow label="Assigned to">
            <span className="flex items-center gap-2">
              <span className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center text-[10px] font-semibold text-brand-700">
                {(shift.user?.name ?? '?').charAt(0).toUpperCase()}
              </span>
              {shift.user?.name ?? 'Unassigned'}
              {isOwn && (
                <span className="text-[11px] text-brand-600 font-medium bg-brand-50 px-1.5 py-0.5 rounded">(You)</span>
              )}
            </span>
          </DetailRow>
        </div>

        <div className="mt-7 flex gap-3">
          {isOwn && !isManager && (
            <button
              onClick={onSwapRequest}
              className="flex-1 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 text-white rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              Request Swap
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2.5 bg-surface-secondary hover:bg-border text-text-primary rounded-xl text-sm font-semibold border border-border transition-all active:scale-[0.98]"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex justify-between items-start py-2 border-b border-border-light last:border-0">
      <span className="text-sm text-text-secondary">{label}</span>
      <span className="text-sm font-medium text-text-primary text-right max-w-[60%]">
        {children}
      </span>
    </div>
  );
}
