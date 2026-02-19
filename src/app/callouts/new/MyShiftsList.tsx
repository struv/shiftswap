'use client';

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/trpc/client';
import { useSearchParams } from 'next/navigation';

interface ShiftWithUser {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  role: string;
  department: string;
  user: { id: string; name: string; email: string } | null;
}

interface MyShiftsListProps {
  userId: string;
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  return dateStr === today;
}

function isTomorrow(dateStr: string): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return dateStr === tomorrow.toISOString().split('T')[0];
}

export function MyShiftsList({ userId }: MyShiftsListProps) {
  const searchParams = useSearchParams();
  const preselectedShiftId = searchParams.get('shift');

  const [shifts, setShifts] = useState<ShiftWithUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Call-out modal state
  const [selectedShift, setSelectedShift] = useState<ShiftWithUser | null>(
    null
  );
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [successShiftId, setSuccessShiftId] = useState<string | null>(null);

  const today = new Date().toISOString().split('T')[0];

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await trpc.shift.list.query({
        userId,
        startDate: today,
      });
      setShifts(result.shifts as ShiftWithUser[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load your shifts'
      );
    } finally {
      setLoading(false);
    }
  }, [userId, today]);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  // Auto-select shift if coming from dashboard with ?shift=id
  useEffect(() => {
    if (preselectedShiftId && shifts.length > 0 && !selectedShift) {
      const match = shifts.find((s) => s.id === preselectedShiftId);
      if (match) {
        setSelectedShift(match);
      }
    }
  }, [preselectedShiftId, shifts, selectedShift]);

  const handlePostCallout = async () => {
    if (!selectedShift) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await trpc.callout.create.mutate({
        shiftId: selectedShift.id,
        reason: reason.trim() || undefined,
      });
      setSuccessShiftId(selectedShift.id);
      setSelectedShift(null);
      setReason('');
      // Remove the shift from list after success animation
      setTimeout(() => {
        setShifts((prev) => prev.filter((s) => s.id !== successShiftId));
      }, 2000);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to post call-out'
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      {/* Page description */}
      <div className="mb-6">
        <p className="text-sm text-text-secondary">
          Select an upcoming shift you can&apos;t work. Your call-out will be
          posted for other team members to pick up.
        </p>
      </div>

      {/* Error alert */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2 animate-fade-in-down">
          <svg
            width="16"
            height="16"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="shrink-0"
          >
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
          <button
            onClick={fetchShifts}
            className="ml-auto text-red-800 underline text-xs font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-surface rounded-2xl border border-border p-5"
            >
              <div className="flex justify-between items-center">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl animate-shimmer" />
                  <div className="space-y-2">
                    <div className="h-4 w-32 rounded-lg animate-shimmer" />
                    <div className="h-3 w-48 rounded-lg animate-shimmer" />
                  </div>
                </div>
                <div className="h-9 w-28 rounded-xl animate-shimmer" />
              </div>
            </div>
          ))}
        </div>
      ) : shifts.length > 0 ? (
        <div className="space-y-3 animate-fade-in-up">
          {shifts.map((shift) => (
            <ShiftRow
              key={shift.id}
              shift={shift}
              isSuccess={successShiftId === shift.id}
              onSelect={() => {
                setSelectedShift(shift);
                setSubmitError(null);
              }}
            />
          ))}
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-border p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-surface-secondary flex items-center justify-center mx-auto mb-4">
            <svg
              width="24"
              height="24"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-text-tertiary"
            >
              <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
              <line x1="16" y1="2" x2="16" y2="6" />
              <line x1="8" y1="2" x2="8" y2="6" />
              <line x1="3" y1="10" x2="21" y2="10" />
            </svg>
          </div>
          <p className="text-sm font-medium text-text-primary mb-1">
            No upcoming shifts
          </p>
          <p className="text-sm text-text-tertiary">
            You don&apos;t have any upcoming shifts to call out from.
          </p>
        </div>
      )}

      {/* Call-out confirmation modal */}
      {selectedShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
          <div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm"
            onClick={() => {
              if (!submitting) {
                setSelectedShift(null);
                setReason('');
                setSubmitError(null);
              }
            }}
          />
          <div className="relative bg-surface rounded-2xl shadow-xl max-w-md w-full mx-4 p-7 border border-border animate-scale-in">
            {/* Header */}
            <div className="flex items-center gap-3 mb-5">
              <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="text-rose-600"
                >
                  <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                  <line x1="12" y1="9" x2="12" y2="13" />
                  <line x1="12" y1="17" x2="12.01" y2="17" />
                </svg>
              </div>
              <div>
                <h3 className="text-base font-semibold text-text-primary">
                  Post Call-Out
                </h3>
                <p className="text-sm text-text-secondary">
                  Let the team know you can&apos;t work this shift
                </p>
              </div>
            </div>

            {/* Shift details card */}
            <div className="bg-surface-secondary rounded-xl border border-border p-4 mb-5">
              <div className="flex items-center gap-3 mb-2">
                <svg
                  width="16"
                  height="16"
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
                <span className="text-sm font-semibold text-text-primary">
                  {formatDate(selectedShift.date)}
                </span>
                {isToday(selectedShift.date) && (
                  <span className="text-[11px] font-medium bg-rose-100 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200">
                    Today
                  </span>
                )}
                {isTomorrow(selectedShift.date) && (
                  <span className="text-[11px] font-medium bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full border border-amber-200">
                    Tomorrow
                  </span>
                )}
              </div>
              <div className="text-sm text-text-secondary flex items-center gap-1.5 flex-wrap">
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
                {formatTime(selectedShift.start_time)} -{' '}
                {formatTime(selectedShift.end_time)}
                <span className="text-text-tertiary">&middot;</span>
                <span className="capitalize">{selectedShift.role}</span>
                <span className="text-text-tertiary">&middot;</span>
                {selectedShift.department}
              </div>
            </div>

            {/* Reason input */}
            <div className="mb-5">
              <label
                htmlFor="callout-reason"
                className="block text-sm font-medium text-text-primary mb-1.5"
              >
                Reason{' '}
                <span className="text-text-tertiary font-normal">
                  (optional)
                </span>
              </label>
              <textarea
                id="callout-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                placeholder="e.g. Feeling sick, family emergency..."
                rows={3}
                maxLength={500}
                className="w-full bg-surface-secondary border border-border rounded-xl px-4 py-3 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent resize-none transition-all"
              />
              <div className="text-[11px] text-text-tertiary mt-1 text-right">
                {reason.length}/500
              </div>
            </div>

            {/* Error */}
            {submitError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2 animate-fade-in-down">
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="shrink-0"
                >
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                {submitError}
              </div>
            )}

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={() => {
                  setSelectedShift(null);
                  setReason('');
                  setSubmitError(null);
                }}
                disabled={submitting}
                className="flex-1 px-4 py-2.5 bg-surface-secondary hover:bg-border text-text-primary rounded-xl text-sm font-medium border border-border transition-all duration-200 active:scale-[0.98] disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePostCallout}
                disabled={submitting}
                className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-400 text-white rounded-xl text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
              >
                {submitting ? (
                  <>
                    <svg
                      className="animate-spin h-4 w-4"
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
                    Posting...
                  </>
                ) : (
                  "I Can't Work This Shift"
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface ShiftRowProps {
  shift: ShiftWithUser;
  isSuccess: boolean;
  onSelect: () => void;
}

function ShiftRow({ shift, isSuccess, onSelect }: ShiftRowProps) {
  const dateLabel = isToday(shift.date)
    ? 'Today'
    : isTomorrow(shift.date)
      ? 'Tomorrow'
      : null;

  return (
    <div
      className={`bg-surface rounded-2xl border p-5 transition-all duration-300 ${
        isSuccess
          ? 'border-rose-300 bg-rose-50/50'
          : 'border-border hover:shadow-sm hover:border-border-hover'
      }`}
    >
      <div className="flex justify-between items-center gap-4">
        <div className="flex items-center gap-4 min-w-0">
          {/* Date badge */}
          <div
            className={`w-12 h-12 rounded-xl flex flex-col items-center justify-center shrink-0 ${
              isToday(shift.date)
                ? 'bg-rose-50 border border-rose-200'
                : 'bg-brand-50 border border-brand-100'
            }`}
          >
            <span
              className={`text-[10px] font-medium leading-none ${
                isToday(shift.date) ? 'text-rose-500' : 'text-brand-500'
              }`}
            >
              {new Date(shift.date + 'T00:00:00').toLocaleDateString('en-US', {
                weekday: 'short',
              })}
            </span>
            <span
              className={`text-sm font-bold leading-tight ${
                isToday(shift.date) ? 'text-rose-700' : 'text-brand-700'
              }`}
            >
              {new Date(shift.date + 'T00:00:00').getDate()}
            </span>
          </div>

          {/* Shift info */}
          <div className="min-w-0">
            <div className="flex items-center gap-2 mb-0.5">
              <span className="text-sm font-semibold text-text-primary">
                {formatDate(shift.date)}
              </span>
              {dateLabel && (
                <span
                  className={`text-[11px] font-medium px-2 py-0.5 rounded-full border ${
                    dateLabel === 'Today'
                      ? 'bg-rose-100 text-rose-700 border-rose-200'
                      : 'bg-amber-100 text-amber-700 border-amber-200'
                  }`}
                >
                  {dateLabel}
                </span>
              )}
            </div>
            <div className="text-sm text-text-secondary flex items-center gap-1.5 flex-wrap">
              <svg
                width="13"
                height="13"
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
              <span className="text-text-tertiary">&middot;</span>
              <span className="capitalize">{shift.role}</span>
              <span className="text-text-tertiary">&middot;</span>
              {shift.department}
            </div>
          </div>
        </div>

        {/* Action */}
        <div className="shrink-0">
          {isSuccess ? (
            <div className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 text-white rounded-xl text-sm font-medium">
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <polyline points="20 6 9 17 4 12" />
              </svg>
              Posted
            </div>
          ) : (
            <button
              onClick={onSelect}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-xl text-sm font-medium transition-all duration-200 shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              <svg
                width="14"
                height="14"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
                <line x1="12" y1="9" x2="12" y2="13" />
                <line x1="12" y1="17" x2="12.01" y2="17" />
              </svg>
              Can&apos;t Work
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
