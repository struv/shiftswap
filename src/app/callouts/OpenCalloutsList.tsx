'use client';

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/trpc/client';

interface CalloutShift {
  id: string;
  user_id: string;
  date: string;
  start_time: string;
  end_time: string;
  role: string;
  department: string;
  user: { id: string; name: string; email: string } | null;
}

interface CalloutUser {
  id: string;
  name: string;
  email: string;
}

interface ClaimUser {
  id: string;
  name: string;
  email: string;
}

interface ClaimApprover {
  id: string;
  name: string;
}

interface ClaimWithDetails {
  id: string;
  callout_id: string;
  user_id: string;
  claimed_at: string;
  status: 'pending' | 'approved' | 'rejected';
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  user: ClaimUser | null;
  approver: ClaimApprover | null;
}

interface CalloutWithDetails {
  id: string;
  shift_id: string;
  user_id: string;
  reason: string | null;
  posted_at: string;
  status: 'open' | 'claimed' | 'approved' | 'cancelled';
  created_at: string;
  updated_at: string;
  shift: CalloutShift | null;
  user: CalloutUser | null;
  claims: ClaimWithDetails[];
}

interface OpenCalloutsListProps {
  userId: string;
  isManager: boolean;
}

const STATUS_BADGES: Record<string, { bg: string; text: string; dot: string }> = {
  open: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-400' },
  claimed: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  approved: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-400' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
  pending: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-400' },
  rejected: { bg: 'bg-red-50', text: 'text-red-700', dot: 'bg-red-400' },
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

export function OpenCalloutsList({ userId, isManager }: OpenCalloutsListProps) {
  const [callouts, setCallouts] = useState<CalloutWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterStatus>('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchCallouts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const input = filter === 'all' ? {} : { status: filter as 'open' | 'claimed' | 'approved' | 'cancelled' };
      const result = await trpc.callout.list.query(input);
      setCallouts(result.callouts as CalloutWithDetails[]);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load callouts');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    fetchCallouts();
  }, [fetchCallouts]);

  const handleClaim = async (calloutId: string) => {
    setActionLoading(calloutId);
    setActionError(null);
    try {
      await trpc.callout.claim.mutate({ calloutId });
      fetchCallouts();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to claim shift');
    } finally {
      setActionLoading(null);
    }
  };

  const handleApproveClaim = async (claimId: string) => {
    setActionLoading(claimId);
    setActionError(null);
    try {
      await trpc.callout.approveClaim.mutate({ claimId });
      fetchCallouts();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to approve claim');
    } finally {
      setActionLoading(null);
    }
  };

  const handleRejectClaim = async (claimId: string) => {
    setActionLoading(claimId);
    setActionError(null);
    try {
      await trpc.callout.rejectClaim.mutate({ claimId });
      fetchCallouts();
    } catch (err) {
      setActionError(err instanceof Error ? err.message : 'Failed to reject claim');
    } finally {
      setActionLoading(null);
    }
  };

  // Manager view: separate pending claims for approval
  const calloutsWithPendingClaims = isManager
    ? callouts.filter((c) => c.claims?.some((cl) => cl.status === 'pending'))
    : [];
  const otherCallouts = isManager
    ? callouts.filter((c) => !c.claims?.some((cl) => cl.status === 'pending'))
    : callouts;

  return (
    <div>
      {/* Filter controls */}
      <div className="flex items-center gap-1.5 mb-6 bg-surface-secondary p-1 rounded-xl border border-border-light w-fit">
        {(['all', 'open', 'claimed', 'approved', 'cancelled'] as FilterStatus[]).map(
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
          <button onClick={fetchCallouts} className="ml-auto text-red-800 underline text-xs font-medium">
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
          <button onClick={() => setActionError(null)} className="ml-auto text-red-800 underline text-xs font-medium">
            Dismiss
          </button>
        </div>
      )}

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface rounded-2xl border border-border p-6">
              <div className="flex justify-between items-start">
                <div className="space-y-2.5 flex-1">
                  <div className="flex items-center gap-3">
                    <div className="h-4 w-32 rounded-lg animate-shimmer" />
                    <div className="h-6 w-20 rounded-lg animate-shimmer" />
                  </div>
                  <div className="h-3 w-48 rounded-lg animate-shimmer" />
                  <div className="h-3 w-24 rounded-lg animate-shimmer" />
                </div>
                <div className="h-9 w-28 rounded-xl animate-shimmer" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {/* Manager: Pending Claims for Approval */}
          {isManager && calloutsWithPendingClaims.length > 0 && filter === 'all' && (
            <div className="mb-8 animate-fade-in-up">
              <h2 className="text-base font-semibold text-text-primary mb-4 flex items-center gap-2">
                Pending Claim Approvals
                <span className="px-2 py-0.5 bg-amber-50 text-amber-700 text-xs font-semibold rounded-lg border border-amber-200">
                  {calloutsWithPendingClaims.reduce(
                    (acc, c) => acc + (c.claims?.filter((cl) => cl.status === 'pending').length ?? 0),
                    0
                  )}
                </span>
              </h2>
              <div className="space-y-3">
                {calloutsWithPendingClaims.map((callout) => (
                  <CalloutCard
                    key={callout.id}
                    callout={callout}
                    userId={userId}
                    isManager={isManager}
                    actionLoading={actionLoading}
                    onClaim={handleClaim}
                    onApproveClaim={handleApproveClaim}
                    onRejectClaim={handleRejectClaim}
                  />
                ))}
              </div>
            </div>
          )}

          {/* All/Other Callouts */}
          {(isManager && filter === 'all' ? otherCallouts : callouts).length > 0 ? (
            <div className="animate-fade-in-up">
              {isManager && calloutsWithPendingClaims.length > 0 && filter === 'all' && (
                <h2 className="text-base font-semibold text-text-primary mb-4">
                  All Call-outs
                </h2>
              )}
              <div className="space-y-3">
                {(isManager && filter === 'all' ? otherCallouts : callouts).map((callout) => (
                  <CalloutCard
                    key={callout.id}
                    callout={callout}
                    userId={userId}
                    isManager={isManager}
                    actionLoading={actionLoading}
                    onClaim={handleClaim}
                    onApproveClaim={handleApproveClaim}
                    onRejectClaim={handleRejectClaim}
                  />
                ))}
              </div>
            </div>
          ) : (
            (!isManager || filter !== 'all' || calloutsWithPendingClaims.length === 0) && (
              <div className="bg-surface rounded-2xl border border-border p-12 text-center">
                <div className="w-14 h-14 rounded-full bg-surface-secondary flex items-center justify-center mx-auto mb-4">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary">
                    <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                    <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                  </svg>
                </div>
                <p className="text-sm text-text-tertiary">No call-outs found.</p>
              </div>
            )
          )}
        </>
      )}
    </div>
  );
}

interface CalloutCardProps {
  callout: CalloutWithDetails;
  userId: string;
  isManager: boolean;
  actionLoading: string | null;
  onClaim: (calloutId: string) => void;
  onApproveClaim: (claimId: string) => void;
  onRejectClaim: (claimId: string) => void;
}

function CalloutCard({
  callout,
  userId,
  isManager,
  actionLoading,
  onClaim,
  onApproveClaim,
  onRejectClaim,
}: CalloutCardProps) {
  const shift = callout.shift;
  const isOwnCallout = callout.user_id === userId;
  const hasClaimed = callout.claims?.some(
    (cl) => cl.user_id === userId && cl.status === 'pending'
  );
  const canClaim = callout.status === 'open' && !isOwnCallout && !hasClaimed;
  const pendingClaims = callout.claims?.filter((cl) => cl.status === 'pending') ?? [];

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
          {/* Header row */}
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center">
                <span className="text-[10px] font-semibold text-rose-700">
                  {(callout.user?.name ?? '?').charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm font-semibold text-text-primary">
                {callout.user?.name ?? 'Unknown'} called out
              </span>
            </div>
            <StatusBadge status={callout.status} />
          </div>

          {/* Shift details */}
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

          {callout.reason && (
            <div className="text-sm text-text-secondary mt-1.5">
              <span className="font-medium text-text-primary">Reason:</span> {callout.reason}
            </div>
          )}

          {/* Timestamp */}
          <div className="text-[11px] text-text-tertiary mt-2.5 flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Posted{' '}
            {new Date(callout.posted_at || callout.created_at).toLocaleDateString('en-US', {
              month: 'short',
              day: 'numeric',
              hour: 'numeric',
              minute: '2-digit',
            })}
          </div>

          {/* Claims section */}
          {callout.claims && callout.claims.length > 0 && (
            <div className="mt-4 pt-3 border-t border-border-light">
              <div className="text-xs font-semibold text-text-secondary uppercase tracking-wider mb-2">
                Claims ({callout.claims.length})
              </div>
              <div className="space-y-2">
                {callout.claims.map((claim) => (
                  <div
                    key={claim.id}
                    className="flex items-center justify-between py-2 px-3 bg-surface-secondary/50 rounded-xl"
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-brand-100 flex items-center justify-center">
                        <span className="text-[9px] font-semibold text-brand-700">
                          {(claim.user?.name ?? '?').charAt(0).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-text-primary">
                        {claim.user?.name ?? 'Unknown'}
                      </span>
                      {claim.user_id === userId && (
                        <span className="text-[11px] text-brand-600 font-medium bg-brand-50 px-1.5 py-0.5 rounded-md border border-brand-200">
                          You
                        </span>
                      )}
                      <StatusBadge status={claim.status} />
                    </div>

                    {/* Manager approve/reject actions on pending claims */}
                    {isManager && claim.status === 'pending' && (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => onApproveClaim(claim.id)}
                          disabled={actionLoading === claim.id}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                        >
                          {actionLoading === claim.id ? (
                            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : (
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="20 6 9 17 4 12" />
                            </svg>
                          )}
                          Approve
                        </button>
                        <button
                          onClick={() => onRejectClaim(claim.id)}
                          disabled={actionLoading === claim.id}
                          className="inline-flex items-center gap-1 px-3 py-1.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white rounded-lg text-xs font-medium transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
                        >
                          Reject
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Claim action button */}
        <div className="ml-4 shrink-0">
          {canClaim && (
            <button
              onClick={() => onClaim(callout.id)}
              disabled={actionLoading === callout.id}
              className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              {actionLoading === callout.id ? (
                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                  <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                </svg>
              )}
              I&apos;ll Take It
            </button>
          )}
          {hasClaimed && (
            <span className="inline-flex items-center gap-1.5 px-3 py-2 bg-amber-50 text-amber-700 rounded-xl text-sm font-medium border border-amber-200">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <polyline points="12 6 12 12 16 14" />
              </svg>
              Claim Pending
            </span>
          )}
          {isOwnCallout && (
            <span className="text-xs text-text-tertiary italic">Your call-out</span>
          )}
        </div>
      </div>
    </div>
  );
}
