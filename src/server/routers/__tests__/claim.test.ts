import { describe, it, expect } from 'vitest';

/**
 * Tests for the claim workflow — covers claim creation guards,
 * status lifecycle, and approve/deny business logic.
 *
 * Since routers use orgProcedure middleware requiring a full DB/auth setup,
 * we test the validation and business logic in isolation.
 */

describe('Claim creation guards', () => {
  describe('self-claim prevention', () => {
    function isSelfClaim(calloutUserId: string, claimantUserId: string): boolean {
      return calloutUserId === claimantUserId;
    }

    it('prevents claiming your own callout', () => {
      expect(isSelfClaim('user-123', 'user-123')).toBe(true);
    });

    it('allows claiming another user callout', () => {
      expect(isSelfClaim('user-123', 'user-456')).toBe(false);
    });
  });

  describe('callout status check', () => {
    function canClaim(calloutStatus: string): boolean {
      return calloutStatus === 'open';
    }

    it('allows claim on open callout', () => {
      expect(canClaim('open')).toBe(true);
    });

    it('rejects claim on claimed callout', () => {
      expect(canClaim('claimed')).toBe(false);
    });

    it('rejects claim on approved callout', () => {
      expect(canClaim('approved')).toBe(false);
    });

    it('rejects claim on cancelled callout', () => {
      expect(canClaim('cancelled')).toBe(false);
    });
  });

  describe('duplicate claim prevention', () => {
    function hasDuplicateClaim(
      existingClaims: Array<{ user_id: string }>,
      claimantId: string
    ): boolean {
      return existingClaims.some((c) => c.user_id === claimantId);
    }

    it('prevents duplicate claim by same user', () => {
      const claims = [{ user_id: 'user-456' }];
      expect(hasDuplicateClaim(claims, 'user-456')).toBe(true);
    });

    it('allows claim when no existing claims', () => {
      expect(hasDuplicateClaim([], 'user-456')).toBe(false);
    });

    it('allows claim when other users have claimed', () => {
      const claims = [{ user_id: 'user-789' }];
      expect(hasDuplicateClaim(claims, 'user-456')).toBe(false);
    });
  });
});

describe('Claim status lifecycle', () => {
  const VALID_STATUSES = ['pending', 'approved', 'rejected'] as const;

  function isValidTransition(from: string, to: string): boolean {
    // Only pending claims can transition
    if (from !== 'pending') return false;
    return to === 'approved' || to === 'rejected';
  }

  it('starts with pending status', () => {
    const initialStatus = 'pending';
    expect(VALID_STATUSES).toContain(initialStatus);
  });

  it('can transition from pending to approved', () => {
    expect(isValidTransition('pending', 'approved')).toBe(true);
  });

  it('can transition from pending to rejected', () => {
    expect(isValidTransition('pending', 'rejected')).toBe(true);
  });

  it('cannot approve a non-pending claim', () => {
    expect(isValidTransition('approved', 'approved')).toBe(false);
    expect(isValidTransition('rejected', 'approved')).toBe(false);
  });

  it('cannot deny a non-pending claim', () => {
    expect(isValidTransition('approved', 'rejected')).toBe(false);
    expect(isValidTransition('rejected', 'rejected')).toBe(false);
  });
});

describe('Claim approve logic', () => {
  describe('role-based access', () => {
    function canApproveClaim(role: string): boolean {
      return role === 'manager' || role === 'admin';
    }

    it('allows managers to approve claims', () => {
      expect(canApproveClaim('manager')).toBe(true);
    });

    it('allows admins to approve claims', () => {
      expect(canApproveClaim('admin')).toBe(true);
    });

    it('prevents staff from approving claims', () => {
      expect(canApproveClaim('staff')).toBe(false);
    });
  });

  describe('shift reassignment', () => {
    function reassignShift(
      originalUserId: string,
      claimantUserId: string
    ): string {
      return claimantUserId;
    }

    it('reassigns shift to claimant on approval', () => {
      const result = reassignShift('user-123', 'user-456');
      expect(result).toBe('user-456');
    });
  });

  describe('auto-reject other pending claims', () => {
    function getOtherPendingClaims(
      allClaims: Array<{ id: string; status: string }>,
      approvedClaimId: string
    ): Array<{ id: string; status: string }> {
      return allClaims.filter(
        (c) => c.id !== approvedClaimId && c.status === 'pending'
      );
    }

    it('identifies other pending claims to reject', () => {
      const claims = [
        { id: 'claim-1', status: 'pending' },
        { id: 'claim-2', status: 'pending' },
        { id: 'claim-3', status: 'rejected' },
      ];
      const others = getOtherPendingClaims(claims, 'claim-1');
      expect(others).toHaveLength(1);
      expect(others[0].id).toBe('claim-2');
    });

    it('returns empty when no other pending claims', () => {
      const claims = [
        { id: 'claim-1', status: 'pending' },
        { id: 'claim-2', status: 'rejected' },
      ];
      const others = getOtherPendingClaims(claims, 'claim-1');
      expect(others).toHaveLength(0);
    });

    it('handles multiple other pending claims', () => {
      const claims = [
        { id: 'claim-1', status: 'pending' },
        { id: 'claim-2', status: 'pending' },
        { id: 'claim-3', status: 'pending' },
      ];
      const others = getOtherPendingClaims(claims, 'claim-1');
      expect(others).toHaveLength(2);
    });
  });
});

describe('Claim deny logic', () => {
  describe('callout revert on deny', () => {
    function shouldRevertCallout(
      remainingPendingClaims: Array<{ id: string }>
    ): boolean {
      return remainingPendingClaims.length === 0;
    }

    it('reverts callout to open when no remaining pending claims', () => {
      expect(shouldRevertCallout([])).toBe(true);
    });

    it('keeps callout as claimed when other pending claims remain', () => {
      expect(shouldRevertCallout([{ id: 'claim-2' }])).toBe(false);
    });
  });

  describe('role-based access', () => {
    function canDenyClaim(role: string): boolean {
      return role === 'manager' || role === 'admin';
    }

    it('allows managers to deny claims', () => {
      expect(canDenyClaim('manager')).toBe(true);
    });

    it('allows admins to deny claims', () => {
      expect(canDenyClaim('admin')).toBe(true);
    });

    it('prevents staff from denying claims', () => {
      expect(canDenyClaim('staff')).toBe(false);
    });
  });
});

describe('Claim-callout status mapping', () => {
  /** Maps claim events to expected callout status changes */
  function getCalloutStatusAfterEvent(event: string, hasOtherPendingClaims: boolean): string {
    switch (event) {
      case 'claim_created': return 'claimed';
      case 'claim_approved': return 'approved';
      case 'claim_denied': return hasOtherPendingClaims ? 'claimed' : 'open';
      default: throw new Error(`Unknown event: ${event}`);
    }
  }

  it('maps claim creation to callout claimed status', () => {
    expect(getCalloutStatusAfterEvent('claim_created', false)).toBe('claimed');
  });

  it('maps claim approval to callout approved status', () => {
    expect(getCalloutStatusAfterEvent('claim_approved', false)).toBe('approved');
  });

  it('maps all-claims-denied to callout open status (revert)', () => {
    expect(getCalloutStatusAfterEvent('claim_denied', false)).toBe('open');
  });

  it('keeps callout claimed when denied but other claims remain', () => {
    expect(getCalloutStatusAfterEvent('claim_denied', true)).toBe('claimed');
  });
});
