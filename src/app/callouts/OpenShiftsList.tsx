'use client';

import { useState, useEffect, useCallback } from 'react';
import { trpc } from '@/trpc/client';

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

interface CalloutWithDetails {
  id: string;
  shift_id: string;
  user_id: string;
  reason: string | null;
  posted_at: string;
  status: 'open' | 'claimed' | 'approved' | 'cancelled';
  shift: CalloutShift | null;
  user: CalloutUser | null;
}

interface OpenShiftsListProps {
  userId: string;
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

export function OpenShiftsList({ userId }: OpenShiftsListProps) {
  const [callouts, setCallouts] = useState<CalloutWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [claimingId, setClaimingId] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [claimedId, setClaimedId] = useState<string | null>(null);

  const fetchCallouts = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await trpc.callout.list.query({ status: 'open' });
      setCallouts(result.callouts as CalloutWithDetails[]);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Failed to load open shifts'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCallouts();
  }, [fetchCallouts]);

  const handleClaim = async (calloutId: string) => {
    setClaimingId(calloutId);
    setClaimError(null);
    setClaimedId(null);
    try {
      await trpc.callout.claim.mutate({ calloutId });
      setClaimedId(calloutId);
      // Remove the claimed callout from the list after a brief delay
      setTimeout(() => {
        setCallouts((prev) => prev.filter((c) => c.id !== calloutId));
        setClaimedId(null);
      }, 1500);
    } catch (err) {
      setClaimError(
        err instanceof Error ? err.message : 'Failed to claim shift'
      );
    } finally {
      setClaimingId(null);
    }
  };

  return (
    <div>
      {/* Page description */}
      <div className="mb-6">
        <p className="text-sm text-text-secondary">
          Open shifts available for pickup. Claim a shift to cover for a team
          member.
        </p>
      </div>

      {/* Error alerts */}
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

      {claimError && (
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
          {claimError}
          <button
            onClick={() => setClaimError(null)}
            className="ml-auto text-red-800 underline text-xs font-medium"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Loading skeleton */}
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
                  <div className="h-3 w-56 rounded-lg animate-shimmer" />
                  <div className="h-3 w-36 rounded-lg animate-shimmer" />
                </div>
                <div className="h-9 w-28 rounded-xl animate-shimmer" />
              </div>
            </div>
          ))}
        </div>
      ) : callouts.length > 0 ? (
        <div className="space-y-3 animate-fade-in-up">
          {callouts.map((callout) => (
            <CalloutCard
              key={callout.id}
              callout={callout}
              userId={userId}
              isClaiming={claimingId === callout.id}
              isClaimed={claimedId === callout.id}
              onClaim={() => handleClaim(callout.id)}
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
              <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
              <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
            </svg>
          </div>
          <p className="text-sm font-medium text-text-primary mb-1">
            No open shifts
          </p>
          <p className="text-sm text-text-tertiary">
            All shifts are covered. Check back later for new call-outs.
          </p>
        </div>
      )}
    </div>
  );
}

interface CalloutCardProps {
  callout: CalloutWithDetails;
  userId: string;
  isClaiming: boolean;
  isClaimed: boolean;
  onClaim: () => void;
}

function CalloutCard({
  callout,
  userId,
  isClaiming,
  isClaimed,
  onClaim,
}: CalloutCardProps) {
  const shift = callout.shift;
  const isOwnCallout = callout.user_id === userId;

  const shiftDate = shift
    ? new Date(shift.date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : 'Unknown date';

  return (
    <div
      className={`bg-surface rounded-2xl border border-border p-5 transition-all duration-300 ${
        isClaimed
          ? 'border-emerald-300 bg-emerald-50/50'
          : 'hover:shadow-sm hover:border-border-hover'
      }`}
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex-1 min-w-0">
          {/* Who called out */}
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                <span className="text-[10px] font-semibold text-rose-700">
                  {(callout.user?.name ?? '?').charAt(0).toUpperCase()}
                </span>
              </div>
              <span className="text-sm font-semibold text-text-primary">
                {callout.user?.name ?? 'Unknown User'}
              </span>
            </div>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border bg-rose-50 text-rose-700 border-rose-200">
              <span className="w-1.5 h-1.5 rounded-full bg-rose-400" />
              Called out
            </span>
            {isOwnCallout && (
              <span className="text-[11px] text-rose-600 font-medium bg-rose-50 px-1.5 py-0.5 rounded-md border border-rose-200">
                Your shift
              </span>
            )}
          </div>

          {/* Shift details */}
          {shift && (
            <div className="text-sm text-text-secondary mb-1.5 flex items-center gap-1.5 flex-wrap">
              {/* Date */}
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

          {/* Reason */}
          {callout.reason && (
            <div className="text-sm text-text-secondary mt-1.5">
              <span className="font-medium text-text-primary">Reason:</span>{' '}
              {callout.reason}
            </div>
          )}

          {/* Posted time */}
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
            Posted {formatRelativeTime(callout.posted_at)}
          </div>
        </div>

        {/* Claim button */}
        <div className="flex items-start ml-2 shrink-0">
          {isClaimed ? (
            <div className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 text-white rounded-xl text-sm font-medium">
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
              Claimed
            </div>
          ) : isOwnCallout ? (
            <span className="px-4 py-2 text-sm text-text-tertiary">
              Your call-out
            </span>
          ) : (
            <button
              onClick={onClaim}
              disabled={isClaiming}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              {isClaiming ? (
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
                  <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14z" />
                  <path d="M7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3" />
                </svg>
              )}
              I&apos;ll Take It
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
