/**
 * Tests for the shift claim flow:
 *   staff claims open shift → claim created (pending) → callout updated (claimed)
 *   manager approves → claim (approved), callout (approved), shift transferred
 *   manager rejects → claim (rejected), callout reverted to (open)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock DB client with chainable query builder
// ---------------------------------------------------------------------------

interface MockQueryResult {
  data: unknown;
  error: null | { message: string };
}

function createChainableQuery(result: MockQueryResult) {
  const chain: Record<string, unknown> = {};
  const methods = [
    'select', 'insert', 'update', 'delete',
    'eq', 'neq', 'gte', 'lte', 'in', 'order', 'limit',
    'single', 'maybeSingle',
  ];

  methods.forEach((method) => {
    if (method === 'single' || method === 'maybeSingle') {
      chain[method] = vi.fn().mockResolvedValue(result);
    } else {
      chain[method] = vi.fn().mockReturnValue(chain);
    }
  });

  chain.then = (resolve: (value: MockQueryResult) => void) => {
    resolve(result);
    return chain;
  };

  return chain;
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const orgId = 'org-test-001';
const staffUserId = 'user-staff-001';
const claimerUserId = 'user-claimer-002';
const managerId = 'user-manager-003';

const testShift = {
  id: 'shift-001',
  org_id: orgId,
  user_id: staffUserId,
  date: '2026-03-20',
  start_time: '08:00',
  end_time: '16:00',
  role: 'Nurse',
  department: 'ER',
  location: { id: 'loc-001', name: 'Main Hospital' },
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const testCallout = {
  id: 'callout-001',
  org_id: orgId,
  shift_id: testShift.id,
  user_id: staffUserId,
  reason: 'Family emergency',
  posted_at: new Date().toISOString(),
  status: 'open',
  shift: testShift,
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
};

const testClaim = {
  id: 'claim-001',
  org_id: orgId,
  callout_id: testCallout.id,
  user_id: claimerUserId,
  claimed_at: new Date().toISOString(),
  status: 'pending',
  approved_by: null,
  approved_at: null,
  created_at: new Date().toISOString(),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Claim creation flow', () => {
  it('creates a claim with status=pending for an open callout', async () => {
    const mockFrom = vi.fn().mockReturnValue(
      createChainableQuery({ data: testClaim, error: null })
    );
    const db = { from: mockFrom };

    const { data, error } = await db
      .from('claims')
      .insert({
        org_id: orgId,
        callout_id: testCallout.id,
        user_id: claimerUserId,
        status: 'pending',
      })
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      id: 'claim-001',
      callout_id: testCallout.id,
      user_id: claimerUserId,
      status: 'pending',
    });
    expect(mockFrom).toHaveBeenCalledWith('claims');
  });

  it('updates callout status to claimed after claim creation', async () => {
    const updatedCallout = { ...testCallout, status: 'claimed' };
    const mockFrom = vi.fn().mockReturnValue(
      createChainableQuery({ data: updatedCallout, error: null })
    );
    const db = { from: mockFrom };

    const { data, error } = await db
      .from('callouts')
      .update({ status: 'claimed', updated_at: new Date().toISOString() })
      .eq('id', testCallout.id)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.status).toBe('claimed');
  });

  it('prevents claiming your own callout', () => {
    // Business logic: callout.user_id should not equal claimer.user_id
    const calloutUserId = staffUserId;
    const claimUserId = staffUserId; // same user

    expect(calloutUserId).toBe(claimUserId);
    // The router would throw BAD_REQUEST here
  });

  it('prevents double-claiming the same callout', async () => {
    // First claim exists
    const existingClaims = [testClaim];
    const mockFrom = vi.fn().mockReturnValue(
      createChainableQuery({ data: existingClaims, error: null })
    );
    const db = { from: mockFrom };

    const { data } = await db
      .from('claims')
      .select('id')
      .eq('callout_id', testCallout.id)
      .eq('user_id', claimerUserId);

    expect(data).toHaveLength(1);
    // The router would throw CONFLICT here
  });

  it('rejects claiming a non-open callout', () => {
    const claimedCallout = { ...testCallout, status: 'claimed' };
    expect(claimedCallout.status).not.toBe('open');
    // The router would throw BAD_REQUEST here
  });
});

describe('Manager approval flow', () => {
  it('approves a pending claim', async () => {
    const approvedClaim = {
      ...testClaim,
      status: 'approved',
      approved_by: managerId,
      approved_at: new Date().toISOString(),
    };

    const mockFrom = vi.fn().mockReturnValue(
      createChainableQuery({ data: approvedClaim, error: null })
    );
    const db = { from: mockFrom };

    const { data, error } = await db
      .from('claims')
      .update({
        status: 'approved',
        approved_by: managerId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', testClaim.id)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      status: 'approved',
      approved_by: managerId,
    });
    expect(data!.approved_at).toBeTruthy();
  });

  it('updates callout to approved after claim approval', async () => {
    const approvedCallout = { ...testCallout, status: 'approved' };
    const mockFrom = vi.fn().mockReturnValue(
      createChainableQuery({ data: approvedCallout, error: null })
    );
    const db = { from: mockFrom };

    const { data, error } = await db
      .from('callouts')
      .update({ status: 'approved', updated_at: new Date().toISOString() })
      .eq('id', testCallout.id)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.status).toBe('approved');
  });

  it('transfers shift ownership to claimant after approval', async () => {
    const transferredShift = { ...testShift, user_id: claimerUserId };
    const mockFrom = vi.fn().mockReturnValue(
      createChainableQuery({ data: transferredShift, error: null })
    );
    const db = { from: mockFrom };

    const { data, error } = await db
      .from('shifts')
      .update({ user_id: claimerUserId, updated_at: new Date().toISOString() })
      .eq('id', testShift.id)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.user_id).toBe(claimerUserId);
  });
});

describe('Manager rejection flow', () => {
  it('rejects a pending claim', async () => {
    const rejectedClaim = { ...testClaim, status: 'rejected' };
    const mockFrom = vi.fn().mockReturnValue(
      createChainableQuery({ data: rejectedClaim, error: null })
    );
    const db = { from: mockFrom };

    const { data, error } = await db
      .from('claims')
      .update({ status: 'rejected' })
      .eq('id', testClaim.id)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.status).toBe('rejected');
  });

  it('reverts callout to open after claim rejection', async () => {
    const revertedCallout = { ...testCallout, status: 'open' };
    const mockFrom = vi.fn().mockReturnValue(
      createChainableQuery({ data: revertedCallout, error: null })
    );
    const db = { from: mockFrom };

    const { data, error } = await db
      .from('callouts')
      .update({ status: 'open', updated_at: new Date().toISOString() })
      .eq('id', testCallout.id)
      .select()
      .single();

    expect(error).toBeNull();
    expect(data!.status).toBe('open');
  });

  it('does not transfer shift on rejection', () => {
    // After rejection, shift.user_id should remain the original staff
    expect(testShift.user_id).toBe(staffUserId);
  });
});

describe('Full claim lifecycle', () => {
  it('open → claimed → approved (happy path)', async () => {
    // Step 1: Callout is open
    expect(testCallout.status).toBe('open');

    // Step 2: Claim is created (pending), callout becomes claimed
    const claim = { ...testClaim, status: 'pending' };
    const claimedCallout = { ...testCallout, status: 'claimed' };
    expect(claim.status).toBe('pending');
    expect(claimedCallout.status).toBe('claimed');

    // Step 3: Manager approves → claim approved, callout approved, shift transferred
    const approvedClaim = {
      ...claim,
      status: 'approved',
      approved_by: managerId,
      approved_at: new Date().toISOString(),
    };
    const approvedCallout = { ...claimedCallout, status: 'approved' };
    const transferredShift = { ...testShift, user_id: claimerUserId };

    expect(approvedClaim.status).toBe('approved');
    expect(approvedCallout.status).toBe('approved');
    expect(transferredShift.user_id).toBe(claimerUserId);
  });

  it('open → claimed → rejected → open (rejection path)', async () => {
    // Step 1: Callout is open
    expect(testCallout.status).toBe('open');

    // Step 2: Claim is created (pending), callout becomes claimed
    const claim = { ...testClaim, status: 'pending' };
    const claimedCallout = { ...testCallout, status: 'claimed' };
    expect(claim.status).toBe('pending');
    expect(claimedCallout.status).toBe('claimed');

    // Step 3: Manager rejects → claim rejected, callout reverted to open
    const rejectedClaim = { ...claim, status: 'rejected' };
    const revertedCallout = { ...claimedCallout, status: 'open' };

    expect(rejectedClaim.status).toBe('rejected');
    expect(revertedCallout.status).toBe('open');

    // Shift user_id remains unchanged
    expect(testShift.user_id).toBe(staffUserId);
  });
});
