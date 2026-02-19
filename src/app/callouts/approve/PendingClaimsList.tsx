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
  shift_id: string;
  user_id: string;
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
  approved_by: string | null;
  approved_at: string | null;
  callout: ClaimCallout | null;
  claimant: ClaimUser | null;
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
  const [actionId, setActionId] = useState<string | null>(null);
  const [actionType, setActionType] = useState<'approve' | 'reject' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [completedId, setCompletedId] = useState<string | null>(null);
  const [completedAction, setCompletedAction] = useState<'approved' | 'rejected' | null>(null);
  const [notesId, setNotesId] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

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
    setActionId(claimId);
    setActionType('approve');
    setActionError(null);
    try {
      await trpc.callout.approve.mutate({
        claimId,
        managerNotes: notes || undefined,
      });
      setCompletedId(claimId);
      setCompletedAction('approved');
      setNotesId(null);
      setNotes('');
      setTimeout(() => {
        setClaims((prev) => prev.filter((c) => c.id !== claimId));
        setCompletedId(null);
        setCompletedAction(null);
      }, 1500);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to approve claim'
      );
    } finally {
      setActionId(null);
      setActionType(null);
    }
  };

  const handleReject = async (claimId: string) => {
    setActionId(claimId);
    setActionType('reject');
    setActionError(null);
    try {
      await trpc.callout.reject.mutate({
        claimId,
        managerNotes: notes || undefined,
      });
      setCompletedId(claimId);
      setCompletedAction('rejected');
      setNotesId(null);
      setNotes('');
      setTimeout(() => {
        setClaims((prev) => prev.filter((c) => c.id !== claimId));
        setCompletedId(null);
        setCompletedAction(null);
      }, 1500);
    } catch (err) {
      setActionError(
        err instanceof Error ? err.message : 'Failed to reject claim'
      );
    } finally {
      setActionId(null);
      setActionType(null);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <p className="text-sm text-text-secondary">
          Review and approve or reject shift claims from your team.
        </p>
      </div>

      {/* Error alerts */}
      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2 animate-fade-in-down">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          {error}
          <button onClick={fetchClaims} className="ml-auto text-red-800 underline text-xs font-medium">
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

      {/* Loading skeleton */}
      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-surface rounded-2xl border border-border p-6">
              <div className="space-y-2.5">
                <div className="flex items-center gap-3">
                  <div className="h-4 w-32 rounded-lg animate-shimmer" />
                  <div className="h-6 w-20 rounded-lg animate-shimmer" />
                </div>
                <div className="h-3 w-56 rounded-lg animate-shimmer" />
                <div className="h-3 w-36 rounded-lg animate-shimmer" />
                <div className="flex gap-3 mt-4">
                  <div className="h-9 w-24 rounded-xl animate-shimmer" />
                  <div className="h-9 w-24 rounded-xl animate-shimmer" />
                </div>
              </div>
            </div>
          ))}
        </div>
      ) : claims.length > 0 ? (
        <div className="space-y-3 animate-fade-in-up">
          {claims.map((claim) => (
            <ClaimCard
              key={claim.id}
              claim={claim}
              isActing={actionId === claim.id}
              actionType={actionId === claim.id ? actionType : null}
              isCompleted={completedId === claim.id}
              completedAction={completedId === claim.id ? completedAction : null}
              showNotes={notesId === claim.id}
              notes={notesId === claim.id ? notes : ''}
              onToggleNotes={() => {
                if (notesId === claim.id) {
                  setNotesId(null);
                  setNotes('');
                } else {
                  setNotesId(claim.id);
                  setNotes('');
                }
              }}
              onNotesChange={(val) => setNotes(val)}
              onApprove={() => handleApprove(claim.id)}
              onReject={() => handleReject(claim.id)}
            />
          ))}
        </div>
      ) : (
        <div className="bg-surface rounded-2xl border border-border p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-surface-secondary flex items-center justify-center mx-auto mb-4">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <p className="text-sm font-medium text-text-primary mb-1">
            No pending claims
          </p>
          <p className="text-sm text-text-tertiary">
            All shift claims have been reviewed. Check back later.
          </p>
        </div>
      )}
    </div>
  );
}

interface ClaimCardProps {
  claim: ClaimWithDetails;
  isActing: boolean;
  actionType: 'approve' | 'reject' | null;
  isCompleted: boolean;
  completedAction: 'approved' | 'rejected' | null;
  showNotes: boolean;
  notes: string;
  onToggleNotes: () => void;
  onNotesChange: (val: string) => void;
  onApprove: () => void;
  onReject: () => void;
}

function ClaimCard({
  claim,
  isActing,
  actionType,
  isCompleted,
  completedAction,
  showNotes,
  notes,
  onToggleNotes,
  onNotesChange,
  onApprove,
  onReject,
}: ClaimCardProps) {
  const callout = claim.callout;
  const shift = callout?.shift;
  const calledOutBy = callout?.user;
  const claimant = claim.claimant;

  const shiftDate = shift
    ? new Date(shift.date + 'T00:00:00').toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
      })
    : 'Unknown date';

  const borderClass = isCompleted
    ? completedAction === 'approved'
      ? 'border-emerald-300 bg-emerald-50/50'
      : 'border-red-300 bg-red-50/50'
    : 'hover:shadow-sm hover:border-border-hover';

  return (
    <div className={`bg-surface rounded-2xl border border-border p-5 transition-all duration-300 ${borderClass}`}>
      {/* Claim info */}
      <div className="flex items-start gap-3 mb-3">
        <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center shrink-0">
          <span className="text-[11px] font-semibold text-emerald-700">
            {(claimant?.name ?? '?').charAt(0).toUpperCase()}
          </span>
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-text-primary">
              {claimant?.name ?? 'Unknown'}
            </span>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium border bg-amber-50 text-amber-700 border-amber-200">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
              Pending Approval
            </span>
          </div>
          <p className="text-sm text-text-secondary mt-0.5">
            wants to cover for{' '}
            <span className="font-medium text-text-primary">
              {calledOutBy?.name ?? 'Unknown'}
            </span>
          </p>
        </div>
      </div>

      {/* Shift details */}
      {shift && (
        <div className="ml-11 mb-2">
          <div className="text-sm text-text-secondary flex items-center gap-1.5 flex-wrap">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary shrink-0">
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

          {shift.location && (
            <div className="text-sm text-text-secondary mt-1 flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary shrink-0">
                <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                <circle cx="12" cy="10" r="3" />
              </svg>
              {shift.location.name}
            </div>
          )}

          {callout?.reason && (
            <div className="text-sm text-text-secondary mt-1.5">
              <span className="font-medium text-text-primary">Call-out reason:</span>{' '}
              {callout.reason}
            </div>
          )}

          <div className="text-[11px] text-text-tertiary mt-2 flex items-center gap-1">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            Claimed {formatRelativeTime(claim.claimed_at)}
          </div>
        </div>
      )}

      {/* Notes input (toggled) */}
      {showNotes && (
        <div className="ml-11 mt-3 mb-3 animate-fade-in-down">
          <textarea
            value={notes}
            onChange={(e) => onNotesChange(e.target.value)}
            placeholder="Add optional notes..."
            rows={2}
            className="w-full px-3 py-2 text-sm bg-surface-secondary border border-border rounded-lg text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-brand-500 resize-none transition-all"
          />
        </div>
      )}

      {/* Actions */}
      <div className="ml-11 mt-3 flex items-center gap-2">
        {isCompleted ? (
          <div
            className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-medium ${
              completedAction === 'approved'
                ? 'bg-emerald-600 text-white'
                : 'bg-red-600 text-white'
            }`}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              {completedAction === 'approved' ? (
                <polyline points="20 6 9 17 4 12" />
              ) : (
                <>
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </>
              )}
            </svg>
            {completedAction === 'approved' ? 'Approved' : 'Rejected'}
          </div>
        ) : (
          <>
            <button
              onClick={onApprove}
              disabled={isActing}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 disabled:bg-emerald-400 text-white rounded-xl text-sm font-medium transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              {isActing && actionType === 'approve' ? (
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              )}
              Approve
            </button>
            <button
              onClick={onReject}
              disabled={isActing}
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-surface-secondary hover:bg-border disabled:opacity-50 text-text-primary rounded-xl text-sm font-medium border border-border transition-all active:scale-[0.98]"
            >
              {isActing && actionType === 'reject' ? (
                <svg className="animate-spin h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
              ) : (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              )}
              Reject
            </button>
            <button
              onClick={onToggleNotes}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-text-secondary hover:text-text-primary text-sm transition-colors"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
              </svg>
              {showNotes ? 'Hide notes' : 'Add notes'}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
