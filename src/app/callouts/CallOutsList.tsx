'use client';

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/trpc/client';

interface CallOutShift {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  role: string;
  department: string;
  user: { id: string; name: string; email: string } | null;
}

interface CallOutUser {
  id: string;
  name: string;
  email: string;
}

interface CallOutWithDetails {
  id: string;
  shift_id: string;
  user_id: string;
  reason: string | null;
  posted_at: string;
  status: 'open' | 'claimed' | 'approved' | 'cancelled';
  created_at: string;
  shift: CallOutShift | null;
  user: CallOutUser | null;
}

const STATUS_BADGES: Record<string, { bg: string; text: string; dot: string }> = {
  open: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  claimed: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400' },
  approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
};

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function StatusBadge({ status }: { status: string }) {
  const badge = STATUS_BADGES[status] ?? STATUS_BADGES.cancelled;
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border ${badge.bg} ${badge.text} border-current/10`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${badge.dot}`} />
      {status.charAt(0).toUpperCase() + status.slice(1)}
    </span>
  );
}

type FilterStatus = 'all' | 'open' | 'claimed' | 'approved' | 'cancelled';

interface CallOutsListProps {
  userId: string;
}

export function CallOutsList({ userId }: CallOutsListProps) {
  const [callouts, setCallouts] = useState<CallOutWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('open');
  const [cancellingId, setCancellingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchCallouts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const input =
        filter === 'all'
          ? {}
          : { status: filter as 'open' | 'claimed' | 'approved' | 'cancelled' };
      const result = await trpc.callout.list.query(input);
      setCallouts(result.callouts as CallOutWithDetails[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load call-outs'
      );
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchCallouts();
  }, [fetchCallouts]);

  const handleCancel = async (calloutId: string) => {
    setCancellingId(calloutId);
    setActionError(null);
    try {
      await trpc.callout.cancel.mutate({ id: calloutId });
      fetchCallouts();
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to cancel call-out'
      );
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <div>
      {/* Filter controls */}
      <div className="flex items-center gap-1.5 mb-6 bg-surface-secondary p-1 rounded-xl border border-border-light w-fit">
        {(
          ['all', 'open', 'claimed', 'approved', 'cancelled'] as FilterStatus[]
        ).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
              filter === status
                ? 'bg-surface text-text-primary shadow-sm border border-border'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {status === 'all'
              ? 'All'
              : status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
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
            onClick={fetchCallouts}
            className="ml-auto text-red-800 underline text-xs font-medium"
          >
            Retry
          </button>
        </div>
      )}

      {actionError && (
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
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-surface rounded-2xl border border-border p-6"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-2.5 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-32 rounded-lg animate-shimmer" />
                    <div className="h-6 w-20 rounded-lg animate-shimmer" />
                  </div>
                  <div className="h-3 w-48 rounded-lg animate-shimmer" />
                  <div className="h-3 w-24 rounded-lg animate-shimmer" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : callouts.length === 0 ? (
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
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
              <line x1="12" y1="9" x2="12" y2="13" />
              <line x1="12" y1="17" x2="12.01" y2="17" />
            </svg>
          </div>
          <p className="text-sm text-text-tertiary">
            {filter === 'open'
              ? 'No open call-outs right now.'
              : 'No call-outs found.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {callouts.map((callout) => (
            <CallOutCard
              key={callout.id}
              callout={callout}
              userId={userId}
              isCancelling={cancellingId === callout.id}
              onCancel={() => handleCancel(callout.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface CallOutCardProps {
  callout: CallOutWithDetails;
  userId: string;
  isCancelling: boolean;
  onCancel: () => void;
}

function CallOutCard({
  callout,
  userId,
  isCancelling,
  onCancel,
}: CallOutCardProps) {
  const shift = callout.shift;
  const isOwn = callout.user_id === userId;
  const canCancel = isOwn && callout.status === 'open';

  const shiftDate = shift
    ? new Date(shift.date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : 'Unknown';

  return (
    <div className="bg-surface rounded-2xl border border-border p-5 hover:shadow-sm transition-all duration-200">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center">
                <span className="text-[10px] font-semibold text-rose-700">
                  {(callout.user?.name ?? '?').charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm font-semibold text-text-primary">
                {callout.user?.name ?? 'Unknown User'}
              </span>
            </div>
            <StatusBadge status={callout.status} />
            {isOwn && (
              <span className="text-[11px] text-brand-600 font-medium bg-brand-50 px-1.5 py-0.5 rounded-md border border-brand-200">
                You
              </span>
            )}
          </div>

          {shift && (
            <div className="text-sm text-text-secondary mb-1.5 flex items-center gap-1.5">
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
              <span className="font-medium">{shiftDate}</span> &middot;{' '}
              {formatTime(shift.start_time)} - {formatTime(shift.end_time)}{' '}
              &middot; <span className="capitalize">{shift.role}</span> &middot;{' '}
              {shift.department}
            </div>
          )}

          {callout.reason && (
            <div className="text-sm text-text-secondary mt-1.5">
              <span className="font-medium text-text-primary">Reason:</span>{' '}
              {callout.reason}
            </div>
          )}

          <div className="text-[11px] text-text-tertiary mt-2.5 flex items-center gap-1">
            <svg
              width="12"
              height="12"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Posted{' '}
            {new Date(callout.posted_at || callout.created_at).toLocaleDateString(
              'en-US',
              {
                month: 'short',
                day: 'numeric',
                hour: 'numeric',
                minute: '2-digit',
              }
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-4">
          {canCancel && (
            <button
              onClick={onCancel}
              disabled={isCancelling}
              className="px-3.5 py-2 bg-surface-secondary hover:bg-border disabled:opacity-50 text-text-primary rounded-xl text-sm font-medium border border-border transition-all active:scale-[0.98]"
            >
              {isCancelling ? 'Cancelling...' : 'Cancel'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
