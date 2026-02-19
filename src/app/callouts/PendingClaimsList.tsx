'use client';

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/trpc/client';

interface ClaimShift {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  role: string;
  department: string;
  location: { id: string; name: string } | null;
}

interface ClaimUser {
  id: string;
  name: string;
  email: string;
}

interface ClaimCallout {
  id: string;
  reason: string | null;
  posted_at: string;
  status: string;
  shift: ClaimShift | null;
  user: ClaimUser | null;
}

interface ClaimWithDetails {
  id: string;
  callout_id: string;
  user_id: string;
  claimed_at: string;
  status: 'pending' | 'approved' | 'rejected';
  user: ClaimUser | null;
  callout: ClaimCallout | null;
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

function formatRelativeTime(dateStr: string): string {
  const now = new Date();
  const posted = new Date(dateStr);
  const diffMs = now.getTime() - posted.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return posted.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

export function PendingClaimsList() {
  const [claims, setClaims] = useState<ClaimWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const [actionResult, setActionResult] = useState<{
    id: string;
    action: 'approved' | 'rejected';
  } | null>(null);

  const fetchClaims = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await trpc.callout.listClaims.query({ status: 'pending' });
      setClaims(result.claims as ClaimWithDetails[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load pending claims'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchClaims();
  }, [fetchClaims]);

  const handleApprove = async (claimId: string) => {
    setProcessingId(claimId);
    try {
      await trpc.callout.approveClaim.mutate({ claimId });
      setActionResult({ id: claimId, action: 'approved' });
      setTimeout(() => {
        setClaims((prev) => prev.filter((c) => c.id !== claimId));
        setActionResult(null);
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to approve claim'
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (claimId: string) => {
    setProcessingId(claimId);
    try {
      await trpc.callout.rejectClaim.mutate({ claimId });
      setActionResult({ id: claimId, action: 'rejected' });
      setTimeout(() => {
        setClaims((prev) => prev.filter((c) => c.id !== claimId));
        setActionResult(null);
      }, 1500);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to reject claim'
      );
    } finally {
      setProcessingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2].map((i) => (
          <div
            key={i}
            className="bg-surface rounded-2xl border border-border p-6"
          >
            <div className="flex justify-between items-start">
              <div className="space-y-2.5 flex-1">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-40 rounded-lg animate-shimmer" />
                  <div className="h-6 w-20 rounded-lg animate-shimmer" />
                </div>
                <div className="h-3 w-56 rounded-lg animate-shimmer" />
                <div className="h-3 w-36 rounded-lg animate-shimmer" />
              </div>
              <div className="flex gap-2">
                <div className="h-9 w-24 rounded-lg animate-shimmer" />
                <div className="h-9 w-24 rounded-lg animate-shimmer" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2 animate-fade-in-down">
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
          onClick={fetchClaims}
          className="ml-auto text-red-800 underline text-xs font-medium"
        >
          Retry
        </button>
      </div>
    );
  }

  if (claims.length === 0) {
    return (
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
            <polyline points="20 6 9 17 4 12" />
          </svg>
        </div>
        <p className="text-sm font-medium text-text-primary mb-1">
          No pending claims
        </p>
        <p className="text-sm text-text-tertiary">
          All shift claims have been reviewed.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3 animate-fade-in-up">
      {claims.map((claim) => {
        const callout = claim.callout;
        const shift = callout?.shift;
        const callerUser = callout?.user;
        const claimant = claim.user;
        const isProcessing = processingId === claim.id;
        const result = actionResult?.id === claim.id ? actionResult : null;

        const shiftDate = shift
          ? new Date(shift.date + 'T00:00:00').toLocaleDateString('en-US', {
              weekday: 'short',
              month: 'short',
              day: 'numeric',
            })
          : 'Unknown date';

        return (
          <div
            key={claim.id}
            className={`bg-surface rounded-2xl border border-border p-5 transition-all duration-300 ${
              result?.action === 'approved'
                ? 'border-emerald-300 bg-emerald-50/50'
                : result?.action === 'rejected'
                  ? 'border-rose-300 bg-rose-50/50'
                  : 'hover:shadow-sm hover:border-border-hover'
            }`}
          >
            <div className="flex justify-between items-start gap-4">
              <div className="flex-1 min-w-0">
                {/* Claim summary */}
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-7 h-7 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-semibold text-brand-700">
                        {(claimant?.name ?? '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm font-semibold text-text-primary">
                      {claimant?.name ?? 'Unknown'}
                    </span>
                  </div>
                  <span className="text-xs text-text-tertiary">wants to cover for</span>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                      <span className="text-[9px] font-semibold text-rose-700">
                        {(callerUser?.name ?? '?').charAt(0).toUpperCase()}
                      </span>
                    </div>
                    <span className="text-sm font-medium text-text-primary">
                      {callerUser?.name ?? 'Unknown'}
                    </span>
                  </div>
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border bg-amber-50 text-amber-700 border-amber-200">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    Pending
                  </span>
                </div>

                {/* Shift details */}
                {shift && (
                  <div className="text-sm text-text-secondary mb-1.5 flex items-center gap-1.5 flex-wrap">
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
                    <span className="text-text-tertiary">&middot;</span>
                    {formatTime(shift.start_time)} - {formatTime(shift.end_time)}
                    <span className="text-text-tertiary">&middot;</span>
                    <span className="capitalize">{shift.role}</span>
                    <span className="text-text-tertiary">&middot;</span>
                    {shift.department}
                  </div>
                )}

                {/* Location */}
                {shift?.location && (
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
                      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                      <circle cx="12" cy="10" r="3" />
                    </svg>
                    {shift.location.name}
                  </div>
                )}

                {/* Claimed time */}
                <div className="text-[11px] text-text-tertiary mt-2 flex items-center gap-1">
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
                  Claimed {formatRelativeTime(claim.claimed_at)}
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-start gap-2 ml-2 shrink-0">
                {result ? (
                  <div
                    className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-[6px] text-sm font-medium animate-scale-in ${
                      result.action === 'approved'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-rose-600 text-white'
                    }`}
                  >
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
                      {result.action === 'approved' ? (
                        <polyline points="20 6 9 17 4 12" />
                      ) : (
                        <>
                          <line x1="18" y1="6" x2="6" y2="18" />
                          <line x1="6" y1="6" x2="18" y2="18" />
                        </>
                      )}
                    </svg>
                    {result.action === 'approved' ? 'Approved' : 'Rejected'}
                  </div>
                ) : (
                  <>
                    <button
                      onClick={() => handleReject(claim.id)}
                      disabled={isProcessing}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-text-primary bg-transparent border border-border rounded-[6px] hover:bg-rose-50 hover:border-rose-200 hover:text-rose-700 transition-all active:scale-[0.98] disabled:opacity-50"
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
                        <line x1="18" y1="6" x2="6" y2="18" />
                        <line x1="6" y1="6" x2="18" y2="18" />
                      </svg>
                      Reject
                    </button>
                    <button
                      onClick={() => handleApprove(claim.id)}
                      disabled={isProcessing}
                      className="inline-flex items-center gap-1.5 px-3.5 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-[6px] transition-all shadow-[var(--shadow-sm)] hover:shadow-[var(--shadow-md)] active:scale-[0.98] disabled:bg-emerald-400"
                    >
                      {isProcessing ? (
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
                      ) : (
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
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      )}
                      Approve
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
