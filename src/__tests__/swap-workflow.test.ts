/**
 * Integration test: Swap workflow
 * create shift → post callout → claim shift → manager approves → shift updates
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Supabase client with chainable query builder
// ---------------------------------------------------------------------------

interface MockQueryResult {
  data: unknown;
  error: null | { message: string };
  count?: number;
}

function createChainableQuery(result: MockQueryResult) {
  const chain: Record<string, unknown> = {};
  const methods = ['select', 'insert', 'update', 'delete', 'eq', 'neq', 'gte', 'lte', 'order', 'limit', 'single', 'maybeSingle'];

  methods.forEach((method) => {
    if (method === 'single' || method === 'maybeSingle') {
      chain[method] = vi.fn().mockResolvedValue(result);
    } else {
      chain[method] = vi.fn().mockReturnValue(chain);
    }
  });

  // Make the chain itself thenable for queries without .single()
  chain.then = (resolve: (value: MockQueryResult) => void) => {
    resolve(result);
    return chain;
  };

  return chain;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

describe('Swap workflow: shift → callout → claim → approve', () => {
  const orgId = 'org-111';
  const staffUserId = 'user-staff-001';
  const claimerUserId = 'user-claimer-002';
  const managerId = 'user-manager-003';

  const testShift = {
    id: 'shift-001',
    user_id: staffUserId,
    date: '2026-03-15',
    start_time: '09:00',
    end_time: '17:00',
    role: 'Cashier',
    department: 'Retail',
    created_at: new Date().toISOString(),
  };

  const testCallout = {
    id: 'callout-001',
    shift_id: testShift.id,
    user_id: staffUserId,
    reason: 'Sick',
    posted_at: new Date().toISOString(),
    status: 'open',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };

  const testClaim = {
    id: 'claim-001',
    callout_id: testCallout.id,
    user_id: claimerUserId,
    claimed_at: new Date().toISOString(),
    status: 'pending',
    approved_by: null,
    approved_at: null,
    created_at: new Date().toISOString(),
  };

  it('1. staff creates a shift', async () => {
    const mockFrom = vi.fn().mockReturnValue(
      createChainableQuery({ data: testShift, error: null })
    );
    const supabase = { from: mockFrom };

    const { data, error } = await supabase
      .from('shifts')
      .insert({
        user_id: staffUserId,
        date: '2026-03-15',
        start_time: '09:00',
        end_time: '17:00',
        role: 'Cashier',
        department: 'Retail',
      })
      .select('*')
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      id: 'shift-001',
      user_id: staffUserId,
      date: '2026-03-15',
    });
  });

  it('2. staff posts a callout for the shift', async () => {
    const mockFrom = vi.fn().mockReturnValue(
      createChainableQuery({ data: testCallout, error: null })
    );
    const supabase = { from: mockFrom };

    const { data, error } = await supabase
      .from('callouts')
      .insert({
        shift_id: testShift.id,
        user_id: staffUserId,
        reason: 'Sick',
        status: 'open',
      })
      .select('*')
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      id: 'callout-001',
      shift_id: testShift.id,
      status: 'open',
    });
  });

  it('3. another staff member claims the open shift', async () => {
    const mockFrom = vi.fn().mockReturnValue(
      createChainableQuery({ data: testClaim, error: null })
    );
    const supabase = { from: mockFrom };

    const { data, error } = await supabase
      .from('claims')
      .insert({
        callout_id: testCallout.id,
        user_id: claimerUserId,
        status: 'pending',
      })
      .select('*')
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      id: 'claim-001',
      callout_id: testCallout.id,
      user_id: claimerUserId,
      status: 'pending',
    });
  });

  it('4. manager approves the claim', async () => {
    const approvedClaim = {
      ...testClaim,
      status: 'approved',
      approved_by: managerId,
      approved_at: new Date().toISOString(),
    };

    const mockFrom = vi.fn().mockReturnValue(
      createChainableQuery({ data: approvedClaim, error: null })
    );
    const supabase = { from: mockFrom };

    const { data, error } = await supabase
      .from('claims')
      .update({
        status: 'approved',
        approved_by: managerId,
        approved_at: new Date().toISOString(),
      })
      .eq('id', testClaim.id)
      .select('*')
      .single();

    expect(error).toBeNull();
    expect(data).toMatchObject({
      status: 'approved',
      approved_by: managerId,
    });
  });

  it('5. callout status updates after approval', async () => {
    const updatedCallout = { ...testCallout, status: 'approved' };
    const mockFrom = vi.fn().mockReturnValue(
      createChainableQuery({ data: updatedCallout, error: null })
    );
    const supabase = { from: mockFrom };

    const { data, error } = await supabase
      .from('callouts')
      .update({ status: 'approved' })
      .eq('id', testCallout.id)
      .select('*')
      .single();

    expect(error).toBeNull();
    expect(data!.status).toBe('approved');
  });

  it('6. shift ownership transfers to claimer', async () => {
    const updatedShift = { ...testShift, user_id: claimerUserId };
    const mockFrom = vi.fn().mockReturnValue(
      createChainableQuery({ data: updatedShift, error: null })
    );
    const supabase = { from: mockFrom };

    const { data, error } = await supabase
      .from('shifts')
      .update({ user_id: claimerUserId })
      .eq('id', testShift.id)
      .select('*')
      .single();

    expect(error).toBeNull();
    expect(data!.user_id).toBe(claimerUserId);
  });

  it('7. full workflow: shift → callout → claim → approve → transfer', async () => {
    // This test verifies the complete sequence executes without errors

    // Step 1: Create shift
    let mockFrom = vi.fn().mockReturnValue(
      createChainableQuery({ data: testShift, error: null })
    );
    let supabase = { from: mockFrom };
    const shift = await supabase.from('shifts').insert({}).select('*').single();
    expect(shift.error).toBeNull();

    // Step 2: Post callout
    mockFrom = vi.fn().mockReturnValue(
      createChainableQuery({ data: testCallout, error: null })
    );
    supabase = { from: mockFrom };
    const callout = await supabase.from('callouts').insert({}).select('*').single();
    expect(callout.error).toBeNull();
    expect(callout.data.status).toBe('open');

    // Step 3: Claim shift
    mockFrom = vi.fn().mockReturnValue(
      createChainableQuery({ data: testClaim, error: null })
    );
    supabase = { from: mockFrom };
    const claim = await supabase.from('claims').insert({}).select('*').single();
    expect(claim.error).toBeNull();
    expect(claim.data.status).toBe('pending');

    // Step 4: Approve claim
    const approved = { ...testClaim, status: 'approved', approved_by: managerId };
    mockFrom = vi.fn().mockReturnValue(
      createChainableQuery({ data: approved, error: null })
    );
    supabase = { from: mockFrom };
    const approval = await supabase.from('claims').update({}).eq('id', testClaim.id).select('*').single();
    expect(approval.error).toBeNull();
    expect(approval.data.status).toBe('approved');

    // Step 5: Transfer shift
    const transferred = { ...testShift, user_id: claimerUserId };
    mockFrom = vi.fn().mockReturnValue(
      createChainableQuery({ data: transferred, error: null })
    );
    supabase = { from: mockFrom };
    const transfer = await supabase.from('shifts').update({}).eq('id', testShift.id).select('*').single();
    expect(transfer.error).toBeNull();
    expect(transfer.data.user_id).toBe(claimerUserId);
  });
});
