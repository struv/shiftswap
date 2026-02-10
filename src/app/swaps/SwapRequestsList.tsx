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
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-400' },
  approved: { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-400' },
  denied: { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-400' },
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
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${badge.bg} ${badge.text}`}
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

  // Separate pending approvals for managers
  const pendingApprovals = isManager
    ? swaps.filter((s) => s.status === 'pending')
    : [];
  const otherSwaps = isManager
    ? swaps.filter((s) => s.status !== 'pending')
    : swaps;

  return (
    <div>
      {/* Filter controls */}
      <div className="flex items-center gap-2 mb-6">
        {(['all', 'pending', 'approved', 'denied', 'cancelled'] as FilterStatus[]).map(
          (status) => (
            <button
              key={status}
              onClick={() => setFilter(status)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                filter === status
                  ? 'bg-blue-600 text-white'
                  : 'bg-white border border-gray-300 text-gray-700 hover:bg-gray-50'
              }`}
            >
              {status === 'all' ? 'All' : status.charAt(0).toUpperCase() + status.slice(1)}
            </button>
          )
        )}
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
          <button onClick={fetchSwaps} className="ml-2 underline">
            Retry
          </button>
        </div>
      )}

      {actionError && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {actionError}
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="bg-white rounded-lg shadow p-6 animate-pulse"
            >
              <div className="flex justify-between items-start">
                <div className="space-y-2 flex-1">
                  <div className="h-4 w-32 bg-gray-200 rounded" />
                  <div className="h-3 w-48 bg-gray-200 rounded" />
                  <div className="h-3 w-24 bg-gray-200 rounded" />
                </div>
                <div className="h-6 w-20 bg-gray-200 rounded-full" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Manager: Pending Approvals Queue */}
          {isManager && pendingApprovals.length > 0 && filter !== 'all' ? null : isManager && pendingApprovals.length > 0 && (
            <div className="mb-8">
              <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                Pending Approvals
                <span className="px-2 py-0.5 bg-yellow-100 text-yellow-800 text-sm rounded-full">
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
            <div>
              {isManager && pendingApprovals.length > 0 && filter === 'all' && (
                <h2 className="text-lg font-semibold text-gray-900 mb-4">
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
              <div className="bg-white rounded-lg shadow p-8 text-center">
                <div className="text-gray-400 text-4xl mb-3">&#8644;</div>
                <p className="text-gray-500">No swap requests found.</p>
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
    <div className="bg-white rounded-lg shadow p-5">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2">
            <span className="font-medium text-gray-900">
              {swap.requester?.name ?? 'Unknown User'}
            </span>
            <StatusBadge status={swap.status} />
            {isOwn && (
              <span className="text-xs text-blue-600 font-medium">(Your request)</span>
            )}
          </div>

          {shift && (
            <div className="text-sm text-gray-600 mb-1">
              <span className="font-medium">{shiftDate}</span> &middot;{' '}
              {formatTime(shift.start_time)} - {formatTime(shift.end_time)} &middot;{' '}
              <span className="capitalize">{shift.role}</span> &middot;{' '}
              {shift.department}
            </div>
          )}

          {swap.reason && (
            <div className="text-sm text-gray-500 mt-1">
              <span className="font-medium">Reason:</span> {swap.reason}
            </div>
          )}

          {swap.manager_notes && (
            <div className="text-sm text-gray-500 mt-1">
              <span className="font-medium">Manager notes:</span> {swap.manager_notes}
            </div>
          )}

          <div className="text-xs text-gray-400 mt-2">
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
                className="px-3 py-1.5 bg-green-600 hover:bg-green-700 disabled:bg-green-400 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {actionLoading ? '...' : 'Approve'}
              </button>
              <button
                onClick={onDeny}
                disabled={actionLoading}
                className="px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg text-sm font-medium transition-colors"
              >
                {actionLoading ? '...' : 'Deny'}
              </button>
            </>
          )}
          {canCancel && (
            <button
              onClick={onCancel}
              disabled={actionLoading}
              className="px-3 py-1.5 bg-gray-200 hover:bg-gray-300 disabled:bg-gray-100 text-gray-700 rounded-lg text-sm font-medium transition-colors"
            >
              {actionLoading ? '...' : 'Cancel'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
