'use client';

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/trpc/client';

interface SwapShift {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  role: string;
  department: string;
  user: { id: string; name: string; email: string } | null;
}

interface SwapRequester {
  id: string;
  name: string;
  email: string;
}

interface SwapRequestWithDetails {
  id: string;
  shift_id: string;
  requested_by: string;
  replacement_user_id: string | null;
  reason: string | null;
  status: 'pending' | 'approved' | 'denied' | 'cancelled';
  reviewed_by: string | null;
  reviewed_at: string | null;
  manager_notes: string | null;
  created_at: string;
  updated_at: string;
  shift: SwapShift | null;
  requester: SwapRequester | null;
}

interface SwapRequestsListProps {
  userId: string;
  isManager: boolean;
}

const STATUS_BADGES: Record<string, { bg: string; text: string; dot: string }> = {
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  approved: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  denied: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
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

type FilterStatus = 'all' | 'pending' | 'approved' | 'denied' | 'cancelled';

export function SwapRequestsList({ userId, isManager }: SwapRequestsListProps) {
  const [swaps, setSwaps] = useState<SwapRequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchSwaps = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const input = filter === 'all' ? {} : { status: filter as 'pending' | 'approved' | 'denied' | 'cancelled' };
      const result = await trpc.swap.list.query(input);
      setSwaps(result.swaps as SwapRequestWithDetails[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load swap requests');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchSwaps();
  }, [fetchSwaps]);

  const handleApprove = async (swapId: string) => {
    setActionLoading(swapId);
    setActionError(null);
    try {
      await trpc.swap.approve.mutate({ id: swapId });
      fetchSwaps();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDeny = async (swapId: string) => {
    setActionLoading(swapId);
    setActionError(null);
    try {
      await trpc.swap.deny.mutate({ id: swapId });
      fetchSwaps();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to deny');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancel = async (swapId: string) => {
    setActionLoading(swapId);
    setActionError(null);
    try {
      await trpc.swap.cancel.mutate({ id: swapId });
      fetchSwaps();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to cancel');
    } finally {
      setActionLoading(null);
    }
  };

  const pendingApprovals = isManager
    ? swaps.filter((s) => s.status === 'pending')
    : [];
  const otherSwaps = isManager
    ? swaps.filter((s) => s.status !== 'pending')
    : swaps;

  return (
    <div>
      {/* Filter controls */}
      <div className="flex items-center gap-1.5 mb-6 bg-surface-secondary p-1 rounded-xl border border-border-light w-fit">
        {(['all', 'pending', 'approved', 'denied', 'cancelled'] as FilterStatus[]).map(
          (status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3.5 py-1.5 rounded-lg text-sm font-medium transition-all ${
                filter === status
                  ? 'bg-surface text-text-primary shadow-sm border border-border'
                  : 'text-text-secondary hover:text-text-primary'
              }`}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          )
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2 animate-fade-in-down">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
          <button onClick={fetchSwaps} className="ml-auto text-red-800 underline text-xs font-medium">
            Retry
          </button>
        </div>
      )}

      {actionError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2 animate-fade-in-down">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
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
                <div className="flex gap-2">
                  <div className="h-8 w-20 rounded-xl animate-shimmer" />
                  <div className="h-8 w-16 rounded-xl animate-shimmer" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Manager: Pending Approvals Queue */}
          {isManager && pendingApprovals.length > 0 && filter !== 'all' ? null : isManager && pendingApprovals.length > 0 && (
            <div className="mb-8 animate-fade-in-up">
              <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
                Pending Approvals
                <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-semibold rounded-lg border border-amber-200">
                  {pendingApprovals.length}
                </span>
              </h2>
              <div className="space-y-3">
                {pendingApprovals.map((swap) => (
                  <SwapRequestCard
                    key={swap.id}
                    swap={swap}
                    userId={userId}
                    isManager={isManager}
                    actionLoading={actionLoading === swap.id}
                    onApprove={() => handleApprove(swap.id)}
                    onDeny={() => handleDeny(swap.id)}
                    onCancel={() => handleCancel(swap.id)}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All/Other Requests */}
          {(isManager && filter === 'all' ? otherSwaps : swaps).length > 0 ? (
            <div className="animate-fade-in-up">
              {isManager && pendingApprovals.length > 0 && filter === 'all' && (
                <h2 className="text-base font-semibold text-text-primary mb-4">
                  All Requests
                </h2>
              )}
              <div className="space-y-3">
                {(isManager && filter === 'all' ? otherSwaps : swaps).map(
                  (swap) => (
                    <SwapRequestCard
                      key={swap.id}
                      swap={swap}
                      userId={userId}
                      isManager={isManager}
                      actionLoading={actionLoading === swap.id}
                      onApprove={() => handleApprove(swap.id)}
                      onDeny={() => handleDeny(swap.id)}
                      onCancel={() => handleCancel(swap.id)}
                    />
                  )
                )}
              </div>
            </div>
          ) : (
            !isManager || filter !== 'all' || pendingApprovals.length === 0 ? (
              <div className="bg-surface rounded-2xl border border-border p-12 text-center">
                <div className="w-14 h-14 rounded-full bg-surface-secondary flex items-center justify-center mx-auto mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary">
                    <path d="M16 3l5 5-5 5" />
                    <path d="M21 8H9" />
                    <path d="M8 21l-5-5 5-5" />
                    <path d="M3 16h12" />
                  </svg>
                </div>
                <p className="text-sm text-text-tertiary">No swap requests found.</p>
              </div>
            ) : null
          )}
        </>
      )}
    </div>
  );
}

interface SwapRequestCardProps {
  swap: SwapRequestWithDetails;
  userId: string;
  isManager: boolean;
  actionLoading: boolean;
  onApprove: () => void;
  onDeny: () => void;
  onCancel: () => void;
}

function SwapRequestCard({
  swap,
  userId,
  isManager,
  actionLoading,
  onApprove,
  onDeny,
  onCancel,
}: SwapRequestCardProps) {
  const shift = swap.shift;
  const isOwn = swap.requested_by === userId;
  const canCancel = isOwn && swap.status === 'pending';
  const canApprove = isManager && swap.status === 'pending';

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
              <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center">
                <span className="text-[10px] font-semibold text-brand-700">
                  {(swap.requester?.name ?? '?').charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm font-semibold text-text-primary">
                {swap.requester?.name ?? 'Unknown User'}
              </span>
            </div>
            <StatusBadge status={swap.status} />
            {isOwn && (
              <span className="text-[11px] text-brand-600 font-medium bg-brand-50 px-1.5 py-0.5 rounded-md border border-brand-200">You</span>
            )}
          </div>

          {shift && (
            <div className="text-sm text-text-secondary mb-1.5 flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary shrink-0">
                <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
                <line x1="16" y1="2" x2="16" y2="6" />
                <line x1="8" y1="2" x2="8" y2="6" />
                <line x1="3" y1="10" x2="21" y2="10" />
              </svg>
              <span className="font-medium">{shiftDate}</span> &middot;{' '}
              {formatTime(shift.start_time)} - {formatTime(shift.end_time)} &middot;{' '}
              <span className="capitalize">{shift.role}</span> &middot;{' '}
              {shift.department}
            </div>
          )}

          {swap.reason && (
            <div className="text-sm text-text-secondary mt-1.5">
              <span className="font-medium text-text-primary">Reason:</span> {swap.reason}
            </div>
          )}

          {swap.manager_notes && (
            <div className="text-sm text-text-secondary mt-1.5">
              <span className="font-medium text-text-primary">Manager notes:</span> {swap.manager_notes}
            </div>
          )}

          <div className="text-[11px] text-text-tertiary mt-2.5 flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Requested{' '}
            {new Date(swap.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
            {swap.reviewed_at && (
              <>
                {' '}&middot; Reviewed{' '}
                {new Date(swap.reviewed_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  hour: 'numeric',
                  minute: '2-digit',
                })}
              </>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-4">
          {canApprove && (
            <>
              <button
                onClick={onApprove}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
              >
                {actionLoading ? (
                  <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                ) : (
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
                Approve
              </button>
              <button
                onClick={onDeny}
                disabled={actionLoading}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
              >
                Deny
              </button>
            </>
          )}
          {canCancel && (
            <button
              onClick={onCancel}
              disabled={actionLoading}
              className="px-3.5 py-2 bg-surface-secondary hover:bg-border disabled:opacity-50 text-text-primary rounded-xl text-sm font-medium border border-border transition-all active:scale-[0.98]"
            >
              Cancel
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
