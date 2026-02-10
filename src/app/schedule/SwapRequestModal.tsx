'use client';

import { useState } from 'react';
import { trpc } from '@/trpc/client';

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

interface SwapRequestModalProps {
  shift: ShiftWithUser;
  onClose: () => void;
  onCreated: () => void;
}

function formatTime(timeStr: string): string {
  const [h, m] = timeStr.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const h12 = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${h12}:${m} ${ampm}`;
}

export function SwapRequestModal({
  shift,
  onClose,
  onCreated,
}: SwapRequestModalProps) {
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const shiftDate = new Date(shift.date + 'T00:00:00');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      await trpc.swap.create.mutate({
        shiftId: shift.id,
        reason: reason || undefined,
      });
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create swap request');
    } finally {
      setLoading(false);
    }
  };

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
          Request Swap
        </h2>

        <div className="bg-surface-secondary border border-border-light rounded-xl p-4 mb-5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-brand-50 border border-brand-100 flex items-center justify-center">
              <span className="text-xs font-bold text-brand-600">
                {shiftDate.getDate()}
              </span>
            </div>
            <div>
              <div className="text-sm font-medium text-text-primary">
                {shiftDate.toLocaleDateString('en-US', {
                  weekday: 'long',
                  month: 'long',
                  day: 'numeric',
                })}
              </div>
              <div className="text-xs text-text-secondary mt-0.5">
                {formatTime(shift.start_time)} - {formatTime(shift.end_time)} &middot;{' '}
                {shift.role} &middot; {shift.department}
              </div>
            </div>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm flex items-center gap-2 animate-fade-in-down">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="shrink-0">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-text-primary mb-1.5">
              Reason <span className="text-text-tertiary font-normal">(optional)</span>
            </label>
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              rows={3}
              placeholder="Why do you need to swap this shift?"
              className="w-full px-4 py-2.5 bg-surface border border-border rounded-xl text-sm text-text-primary placeholder:text-text-tertiary transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 resize-none"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-amber-500 hover:bg-amber-600 disabled:bg-amber-400 text-white rounded-xl text-sm font-semibold transition-all shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              {loading ? (
                <>
                  <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Submitting...
                </>
              ) : (
                'Submit Request'
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-surface-secondary hover:bg-border text-text-primary rounded-xl text-sm font-semibold border border-border transition-all active:scale-[0.98]"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
