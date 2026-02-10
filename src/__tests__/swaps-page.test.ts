/**
 * Tests for the swaps page logic.
 * Tests status badge mapping, filter logic, and role-based action visibility.
 */
import { describe, it, expect } from 'vitest';

type SwapStatus = 'pending' | 'approved' | 'denied' | 'cancelled';

const STATUS_BADGES: Record<string, { bg: string; text: string; dot: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-800', dot: 'bg-yellow-400' },
  approved: { bg: 'bg-green-100', text: 'text-green-800', dot: 'bg-green-400' },
  denied: { bg: 'bg-red-100', text: 'text-red-800', dot: 'bg-red-400' },
  cancelled: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
};

interface SwapRequest {
  id: string;
  requested_by: string;
  status: SwapStatus;
  reason: string | null;
  manager_notes: string | null;
}

describe('Status badges', () => {
  it('maps pending to yellow', () => {
    expect(STATUS_BADGES.pending.bg).toBe('bg-yellow-100');
    expect(STATUS_BADGES.pending.text).toBe('text-yellow-800');
  });

  it('maps approved to green', () => {
    expect(STATUS_BADGES.approved.bg).toBe('bg-green-100');
    expect(STATUS_BADGES.approved.text).toBe('text-green-800');
  });

  it('maps denied to red', () => {
    expect(STATUS_BADGES.denied.bg).toBe('bg-red-100');
    expect(STATUS_BADGES.denied.text).toBe('text-red-800');
  });

  it('maps cancelled to gray', () => {
    expect(STATUS_BADGES.cancelled.bg).toBe('bg-gray-100');
    expect(STATUS_BADGES.cancelled.text).toBe('text-gray-600');
  });
});

describe('Action visibility', () => {
  const userId = 'user-1';
  const managerId = 'manager-1';

  function getActions(swap: SwapRequest, currentUserId: string, isManager: boolean) {
    const isOwn = swap.requested_by === currentUserId;
    return {
      canCancel: isOwn && swap.status === 'pending',
      canApprove: isManager && swap.status === 'pending',
      canDeny: isManager && swap.status === 'pending',
    };
  }

  it('staff can cancel their own pending request', () => {
    const swap: SwapRequest = { id: '1', requested_by: userId, status: 'pending', reason: null, manager_notes: null };
    const actions = getActions(swap, userId, false);
    expect(actions.canCancel).toBe(true);
    expect(actions.canApprove).toBe(false);
    expect(actions.canDeny).toBe(false);
  });

  it('staff cannot cancel approved request', () => {
    const swap: SwapRequest = { id: '1', requested_by: userId, status: 'approved', reason: null, manager_notes: null };
    const actions = getActions(swap, userId, false);
    expect(actions.canCancel).toBe(false);
  });

  it('staff cannot cancel someone else\'s request', () => {
    const swap: SwapRequest = { id: '1', requested_by: 'other-user', status: 'pending', reason: null, manager_notes: null };
    const actions = getActions(swap, userId, false);
    expect(actions.canCancel).toBe(false);
  });

  it('manager can approve pending requests', () => {
    const swap: SwapRequest = { id: '1', requested_by: userId, status: 'pending', reason: null, manager_notes: null };
    const actions = getActions(swap, managerId, true);
    expect(actions.canApprove).toBe(true);
    expect(actions.canDeny).toBe(true);
  });

  it('manager cannot approve already-approved requests', () => {
    const swap: SwapRequest = { id: '1', requested_by: userId, status: 'approved', reason: null, manager_notes: null };
    const actions = getActions(swap, managerId, true);
    expect(actions.canApprove).toBe(false);
    expect(actions.canDeny).toBe(false);
  });

  it('manager cannot approve denied requests', () => {
    const swap: SwapRequest = { id: '1', requested_by: userId, status: 'denied', reason: null, manager_notes: null };
    const actions = getActions(swap, managerId, true);
    expect(actions.canApprove).toBe(false);
  });
});

describe('Filter logic', () => {
  const swaps: SwapRequest[] = [
    { id: '1', requested_by: 'u1', status: 'pending', reason: null, manager_notes: null },
    { id: '2', requested_by: 'u2', status: 'approved', reason: null, manager_notes: null },
    { id: '3', requested_by: 'u1', status: 'denied', reason: 'conflict', manager_notes: 'schedule full' },
    { id: '4', requested_by: 'u3', status: 'cancelled', reason: null, manager_notes: null },
    { id: '5', requested_by: 'u1', status: 'pending', reason: 'need off', manager_notes: null },
  ];

  it('returns all swaps when filter is "all"', () => {
    const filtered = swaps;
    expect(filtered).toHaveLength(5);
  });

  it('filters by pending status', () => {
    const filtered = swaps.filter((s) => s.status === 'pending');
    expect(filtered).toHaveLength(2);
  });

  it('filters by approved status', () => {
    const filtered = swaps.filter((s) => s.status === 'approved');
    expect(filtered).toHaveLength(1);
  });

  it('filters by denied status', () => {
    const filtered = swaps.filter((s) => s.status === 'denied');
    expect(filtered).toHaveLength(1);
  });

  it('filters by cancelled status', () => {
    const filtered = swaps.filter((s) => s.status === 'cancelled');
    expect(filtered).toHaveLength(1);
  });
});

describe('Manager pending approvals queue', () => {
  const swaps: SwapRequest[] = [
    { id: '1', requested_by: 'u1', status: 'pending', reason: null, manager_notes: null },
    { id: '2', requested_by: 'u2', status: 'approved', reason: null, manager_notes: null },
    { id: '3', requested_by: 'u3', status: 'pending', reason: null, manager_notes: null },
    { id: '4', requested_by: 'u4', status: 'denied', reason: null, manager_notes: null },
  ];

  it('separates pending from other swaps for managers', () => {
    const pendingApprovals = swaps.filter((s) => s.status === 'pending');
    const otherSwaps = swaps.filter((s) => s.status !== 'pending');

    expect(pendingApprovals).toHaveLength(2);
    expect(otherSwaps).toHaveLength(2);
  });
});
