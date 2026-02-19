'use client';

import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { trpc } from '@/trpc/client';

interface ShiftWithCallout {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  role: string;
  department: string;
  has_callout: boolean;
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

interface CallOutFormProps {
  userId: string;
}

export function CallOutForm({ userId }: CallOutFormProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const preselectedShiftId = searchParams.get('shift');

  const [shifts, setShifts] = useState<ShiftWithCallout[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [selectedShiftId, setSelectedShiftId] = useState<string | null>(
    preselectedShiftId
  );
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const fetchShifts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await trpc.callout.myShifts.query();
      setShifts(result.shifts as ShiftWithCallout[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load your shifts'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchShifts();
  }, [fetchShifts]);

  // Auto-select the preselected shift once shifts load
  useEffect(() => {
    if (preselectedShiftId && shifts.length > 0) {
      const found = shifts.find((s) => s.id === preselectedShiftId);
      if (found && !found.has_callout) {
        setSelectedShiftId(preselectedShiftId);
      }
    }
  }, [preselectedShiftId, shifts]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShiftId) return;

    setSubmitting(true);
    setSubmitError(null);
    try {
      await trpc.callout.create.mutate({
        shiftId: selectedShiftId,
        reason: reason.trim() || undefined,
      });
      setSuccess(true);
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : 'Failed to post call-out'
      );
    } finally {
      setSubmitting(false);
    }
  };

  // Ignore userId for linting — used to confirm ownership is server-side
  void userId;

  if (success) {
    return (
      <div className="bg-surface rounded-2xl border border-border p-8 text-center animate-scale-in">
        <div className="w-14 h-14 rounded-full bg-emerald-50 border border-emerald-200 flex items-center justify-center mx-auto mb-4">
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="text-emerald-600"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <h2 className="text-lg font-semibold text-text-primary mb-1">
          Call-Out Posted
        </h2>
        <p className="text-sm text-text-secondary mb-6">
          Your managers have been notified. Other staff can now pick up this
          shift.
        </p>
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={() => router.push('/dashboard')}
            className="px-4 py-2.5 bg-brand-600 hover:bg-brand-700 text-white rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
          >
            Back to Dashboard
          </button>
          <button
            onClick={() => router.push('/callouts')}
            className="px-4 py-2.5 bg-surface-secondary hover:bg-border text-text-primary rounded-xl text-sm font-medium border border-border transition-all active:scale-[0.98]"
          >
            View Open Call-Outs
          </button>
        </div>
      </div>
    );
  }

  const eligibleShifts = shifts.filter((s) => !s.has_callout);
  const selectedShift = shifts.find((s) => s.id === selectedShiftId);

  return (
    <form onSubmit={handleSubmit}>
      {/* Intro */}
      <div className="mb-6">
        <p className="text-sm text-text-secondary">
          Select the shift you can&apos;t work and optionally add a reason.
          Your managers will be notified and the shift will be posted for
          others to pick up.
        </p>
      </div>

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
            type="button"
            onClick={fetchShifts}
            className="ml-auto text-red-800 underline text-xs font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {submitError && (
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
          {submitError}
        </div>
      )}

      {/* Shift Selection */}
      <div className="mb-6">
        <label className="block text-sm font-medium text-text-primary mb-3">
          Select Shift
        </label>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-surface rounded-2xl border border-border p-5"
              >
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-xl animate-shimmer" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 rounded-lg animate-shimmer" />
                    <div className="h-3 w-48 rounded-lg animate-shimmer" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : eligibleShifts.length === 0 ? (
          <div className="bg-surface rounded-2xl border border-border p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-surface-secondary flex items-center justify-center mx-auto mb-3">
              <svg
                width="20"
                height="20"
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
            <p className="text-sm text-text-tertiary">
              {shifts.length === 0
                ? 'No upcoming shifts found.'
                : 'All your upcoming shifts already have call-outs posted.'}
            </p>
          </div>
        ) : (
          <div className="space-y-2">
            {eligibleShifts.map((shift, i) => {
              const isSelected = selectedShiftId === shift.id;
              return (
                <button
                  key={shift.id}
                  type="button"
                  onClick={() => setSelectedShiftId(shift.id)}
                  className={`w-full text-left rounded-2xl border p-4 transition-all duration-200 animate-fade-in-up stagger-${Math.min(i + 1, 5)} ${
                    isSelected
                      ? 'border-brand-500 bg-brand-50/50 shadow-sm ring-2 ring-brand-500/20'
                      : 'border-border bg-surface hover:border-border hover:bg-surface-secondary/50'
                  }`}
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                        isSelected
                          ? 'bg-brand-100 border border-brand-200'
                          : 'bg-surface-secondary border border-border-light'
                      }`}
                    >
                      <span
                        className={`text-xs font-bold ${
                          isSelected ? 'text-brand-600' : 'text-text-secondary'
                        }`}
                      >
                        {new Date(shift.date + 'T00:00:00').getDate()}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-text-primary">
                        {formatDate(shift.date)}
                      </div>
                      <div className="text-xs text-text-secondary mt-0.5">
                        {formatTime(shift.start_time)} -{' '}
                        {formatTime(shift.end_time)} &middot;{' '}
                        <span className="capitalize">{shift.role}</span>{' '}
                        &middot; {shift.department}
                      </div>
                    </div>
                    <div
                      className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
                        isSelected
                          ? 'border-brand-500 bg-brand-500'
                          : 'border-border'
                      }`}
                    >
                      {isSelected && (
                        <svg
                          width="10"
                          height="10"
                          viewBox="0 0 24 24"
                          fill="none"
                          stroke="white"
                          strokeWidth="3"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        >
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        )}

        {/* Already called-out shifts */}
        {shifts.filter((s) => s.has_callout).length > 0 && (
          <div className="mt-4">
            <p className="text-xs text-text-tertiary mb-2">
              Already called out:
            </p>
            <div className="space-y-1.5">
              {shifts
                .filter((s) => s.has_callout)
                .map((shift) => (
                  <div
                    key={shift.id}
                    className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-surface-secondary/50 border border-border-light opacity-60"
                  >
                    <div className="w-7 h-7 rounded-lg bg-rose-50 border border-rose-200 flex items-center justify-center">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        className="text-rose-500"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                    <div className="text-xs text-text-secondary">
                      {formatDate(shift.date)} &middot;{' '}
                      {formatTime(shift.start_time)} -{' '}
                      {formatTime(shift.end_time)}
                    </div>
                    <span className="ml-auto text-[10px] font-medium text-rose-600 bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-200">
                      Called out
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}
      </div>

      {/* Reason */}
      <div className="mb-8">
        <label
          htmlFor="reason"
          className="block text-sm font-medium text-text-primary mb-2"
        >
          Reason{' '}
          <span className="text-text-tertiary font-normal">(optional)</span>
        </label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="e.g., Sick, family emergency, doctor's appointment..."
          rows={3}
          className="w-full px-4 py-3 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-500 transition-all resize-none"
        />
      </div>

      {/* Selected shift confirmation */}
      {selectedShift && !selectedShift.has_callout && (
        <div className="mb-6 p-4 bg-rose-50/50 border border-rose-200 rounded-xl animate-fade-in">
          <div className="flex items-start gap-3">
            <div className="w-8 h-8 rounded-lg bg-rose-100 flex items-center justify-center shrink-0 mt-0.5">
              <svg
                width="16"
                height="16"
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
              <p className="text-sm font-medium text-rose-800">
                You&apos;re calling out from:
              </p>
              <p className="text-sm text-rose-700 mt-0.5">
                {formatDate(selectedShift.date)} &middot;{' '}
                {formatTime(selectedShift.start_time)} -{' '}
                {formatTime(selectedShift.end_time)} &middot;{' '}
                <span className="capitalize">{selectedShift.role}</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Submit */}
      <button
        type="submit"
        disabled={!selectedShiftId || submitting}
        className="w-full py-3 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 text-white rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md active:scale-[0.98] flex items-center justify-center gap-2"
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
            Posting Call-Out...
          </>
        ) : (
          <>
            <svg
              width="16"
              height="16"
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
            Post Call-Out
          </>
        )}
      </button>
    </form>
  );
}
