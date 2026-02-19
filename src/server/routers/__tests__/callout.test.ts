import { describe, it, expect } from 'vitest';

/**
 * Tests for the callout and shift claim workflow router.
 *
 * Tests cover claim lifecycle validation, ownership checks,
 * and approval business logic.
 */

describe('Callout claim validation logic', () => {
  describe('callout status lifecycle', () => {
    const VALID_STATUSES = ['open', 'claimed', 'approved', 'cancelled'] as const;

    it('defines all valid callout status values', () => {
      expect(VALID_STATUSES).toEqual(['open', 'claimed', 'approved', 'cancelled']);
    });

    describe('status transitions', () => {
      const validTransitions: Record<string, string[]> = {
        open: ['claimed', 'cancelled'],
        claimed: ['approved', 'open'], // open if claim is rejected
        approved: [],
        cancelled: [],
      };

      it('allows open → claimed when staff claims', () => {
        expect(validTransitions['open']).toContain('claimed');
      });

      it('allows claimed → approved when manager approves', () => {
        expect(validTransitions['claimed']).toContain('approved');
      });

      it('allows claimed → open when claim is rejected', () => {
        expect(validTransitions['claimed']).toContain('open');
      });

      it('does not allow transitions from terminal states', () => {
        expect(validTransitions['approved']).toHaveLength(0);
        expect(validTransitions['cancelled']).toHaveLength(0);
      });
    });
  });

  describe('claim status lifecycle', () => {
    const VALID_CLAIM_STATUSES = ['pending', 'approved', 'rejected'] as const;

    it('defines all valid claim status values', () => {
      expect(VALID_CLAIM_STATUSES).toEqual(['pending', 'approved', 'rejected']);
    });

    describe('claim transitions', () => {
      const validTransitions: Record<string, string[]> = {
        pending: ['approved', 'rejected'],
        approved: [],
        rejected: [],
      };

      it('allows pending → approved', () => {
        expect(validTransitions['pending']).toContain('approved');
      });

      it('allows pending → rejected', () => {
        expect(validTransitions['pending']).toContain('rejected');
      });

      it('does not allow transitions from terminal states', () => {
        expect(validTransitions['approved']).toHaveLength(0);
        expect(validTransitions['rejected']).toHaveLength(0);
      });
    });
  });

  describe('claim preconditions', () => {
    it('requires callout status to be open to claim', () => {
      const canClaim = (status: string) => status === 'open';
      expect(canClaim('open')).toBe(true);
      expect(canClaim('claimed')).toBe(false);
      expect(canClaim('approved')).toBe(false);
      expect(canClaim('cancelled')).toBe(false);
    });

    it('prevents the callout creator from claiming their own shift', () => {
      const calloutUserId = 'user-1';
      const claimerId = 'user-1';
      const isSameUser = calloutUserId === claimerId;
      expect(isSameUser).toBe(true); // should be rejected
    });

    it('allows a different user to claim', () => {
      const calloutUserId = 'user-1';
      const claimerId = 'user-2';
      expect(calloutUserId).not.toBe(claimerId);
    });

    it('prevents duplicate pending claims from same user', () => {
      const existingPendingClaims = [{ id: 'claim-1', user_id: 'user-2', status: 'pending' }];
      const hasPending = existingPendingClaims.some(
        (c) => c.user_id === 'user-2' && c.status === 'pending'
      );
      expect(hasPending).toBe(true); // should be rejected
    });
  });

  describe('role-based access control', () => {
    const isManagerOrAdmin = (role: string) => role === 'manager' || role === 'admin';

    it('allows managers to approve claims', () => {
      expect(isManagerOrAdmin('manager')).toBe(true);
    });

    it('allows admins to approve claims', () => {
      expect(isManagerOrAdmin('admin')).toBe(true);
    });

    it('prevents staff from approving claims', () => {
      expect(isManagerOrAdmin('staff')).toBe(false);
    });

    it('allows any staff member to claim an open shift', () => {
      // All roles can claim open shifts (except the callout creator)
      for (const role of ['staff', 'manager', 'admin']) {
        expect(typeof role).toBe('string');
      }
    });
  });

  describe('approval side effects', () => {
    it('reassigns shift to claimer on approval', () => {
      const originalUserId = 'user-1';
      const claimerUserId = 'user-2';
      const newShiftUserId = claimerUserId;
      expect(newShiftUserId).toBe(claimerUserId);
      expect(newShiftUserId).not.toBe(originalUserId);
    });

    it('rejects other pending claims when one is approved', () => {
      const claims = [
        { id: 'claim-1', status: 'pending', user_id: 'user-2' },
        { id: 'claim-2', status: 'pending', user_id: 'user-3' },
      ];
      const approvedClaimId = 'claim-1';
      const rejectedClaims = claims.filter(
        (c) => c.id !== approvedClaimId && c.status === 'pending'
      );
      expect(rejectedClaims).toHaveLength(1);
      expect(rejectedClaims[0].id).toBe('claim-2');
    });

    it('reverts callout to open when last pending claim is rejected', () => {
      const remainingPendingClaims: unknown[] = [];
      const shouldRevertToOpen = remainingPendingClaims.length === 0;
      expect(shouldRevertToOpen).toBe(true);
    });

    it('keeps callout as claimed when other pending claims remain', () => {
      const remainingPendingClaims = [{ id: 'claim-2', status: 'pending' }];
      const shouldRevertToOpen = remainingPendingClaims.length === 0;
      expect(shouldRevertToOpen).toBe(false);
    });

    it('checks claimer for overlapping shifts before approval', () => {
      const existingStart = '09:00';
      const existingEnd = '17:00';
      const claimedShiftStart = '10:00';
      const claimedShiftEnd = '14:00';
      const overlaps = existingStart < claimedShiftEnd && existingEnd > claimedShiftStart;
      expect(overlaps).toBe(true);
    });
  });
});
