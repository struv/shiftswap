/**
 * Integration test: RLS multi-tenancy isolation
 * Verifies that org context middleware enforces tenant isolation.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock @neondatabase/serverless
// ---------------------------------------------------------------------------

const { mockRelease, mockClientQuery, mockConnect, mockPoolQuery, mockEnd, MockPool } = vi.hoisted(
  () => {
    const mockRelease = vi.fn();
    const mockClientQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const mockConnect = vi.fn().mockResolvedValue({
      query: mockClientQuery,
      release: mockRelease,
    });
    const mockPoolQuery = vi.fn().mockResolvedValue({ rows: [], rowCount: 0 });
    const mockEnd = vi.fn().mockResolvedValue(undefined);
    const MockPool = vi.fn(function (this: Record<string, unknown>) {
      this.connect = mockConnect;
      this.query = mockPoolQuery;
      this.end = mockEnd;
    });
    return { mockRelease, mockClientQuery, mockConnect, mockPoolQuery, mockEnd, MockPool };
  },
);

vi.mock('@neondatabase/serverless', () => ({
  Pool: MockPool,
}));

process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';

import { withOrgContext, withOrgTransaction, endPool } from '../lib/db';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  await endPool();
});

describe('RLS multi-tenancy: org isolation', () => {
  const orgA = 'org-aaa-111';
  const orgB = 'org-bbb-222';

  it('sets app.current_org_id to the correct org for Org A', async () => {
    await withOrgContext(orgA, async (client) => {
      await client.query('SELECT * FROM shifts');
    });

    expect(mockClientQuery).toHaveBeenNthCalledWith(
      1,
      "SELECT set_config('app.current_org_id', $1, false)",
      [orgA],
    );
  });

  it('sets app.current_org_id to the correct org for Org B', async () => {
    await withOrgContext(orgB, async (client) => {
      await client.query('SELECT * FROM shifts');
    });

    expect(mockClientQuery).toHaveBeenNthCalledWith(
      1,
      "SELECT set_config('app.current_org_id', $1, false)",
      [orgB],
    );
  });

  it('different org contexts do not leak between calls', async () => {
    // Call 1: Org A
    await withOrgContext(orgA, async (client) => {
      await client.query('SELECT * FROM shifts');
    });

    // Call 2: Org B
    await withOrgContext(orgB, async (client) => {
      await client.query('SELECT * FROM shifts');
    });

    // Verify first call used orgA
    expect(mockClientQuery).toHaveBeenNthCalledWith(
      1,
      "SELECT set_config('app.current_org_id', $1, false)",
      [orgA],
    );

    // Verify third call (second context set) used orgB
    expect(mockClientQuery).toHaveBeenNthCalledWith(
      3,
      "SELECT set_config('app.current_org_id', $1, false)",
      [orgB],
    );

    // Connection was released between calls
    expect(mockRelease).toHaveBeenCalledTimes(2);
  });

  it('withOrgTransaction scopes set_config to transaction', async () => {
    await withOrgTransaction(orgA, async (client) => {
      await client.query('INSERT INTO shifts (id) VALUES ($1)', ['s1']);
    });

    // BEGIN → set_config (with local=true) → INSERT → COMMIT
    expect(mockClientQuery).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockClientQuery).toHaveBeenNthCalledWith(
      2,
      "SELECT set_config('app.current_org_id', $1, true)",
      [orgA],
    );
    expect(mockClientQuery).toHaveBeenNthCalledWith(
      3,
      'INSERT INTO shifts (id) VALUES ($1)',
      ['s1'],
    );
    expect(mockClientQuery).toHaveBeenNthCalledWith(4, 'COMMIT');
  });

  it('org A transaction does not affect org B data', async () => {
    // Org A transaction
    await withOrgTransaction(orgA, async (client) => {
      await client.query('UPDATE shifts SET role = $1', ['OrgA-Role']);
    });

    vi.clearAllMocks();

    // Org B transaction — uses its own org context
    await withOrgTransaction(orgB, async (client) => {
      await client.query('SELECT * FROM shifts');
    });

    // Verify Org B's set_config used orgB, not orgA
    expect(mockClientQuery).toHaveBeenNthCalledWith(
      2,
      "SELECT set_config('app.current_org_id', $1, true)",
      [orgB],
    );
  });

  it('connection is released even if org-scoped query fails', async () => {
    await expect(
      withOrgContext(orgA, async () => {
        throw new Error('query failed');
      }),
    ).rejects.toThrow('query failed');

    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('transaction rolls back on error in org context', async () => {
    await expect(
      withOrgTransaction(orgB, async () => {
        throw new Error('constraint violation');
      }),
    ).rejects.toThrow('constraint violation');

    expect(mockClientQuery).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockClientQuery).toHaveBeenNthCalledWith(
      2,
      "SELECT set_config('app.current_org_id', $1, true)",
      [orgB],
    );
    expect(mockClientQuery).toHaveBeenNthCalledWith(3, 'ROLLBACK');
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});

describe('RLS multi-tenancy: org context middleware', () => {
  it('getOrgContext rejects user without membership', async () => {
    // Test the orgContext module independently
    const { getOrgContext } = await import('../lib/orgContext');

    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: null,
                error: { message: 'No rows found' },
              }),
            }),
          }),
        }),
      }),
    };

    await expect(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      getOrgContext(mockDb as any, 'user-no-org'),
    ).rejects.toThrow('User is not a member of any organization');
  });

  it('getOrgContext returns correct role for org member', async () => {
    // Clear module cache to reset the in-memory cache
    vi.resetModules();
    const { getOrgContext } = await import('../lib/orgContext');

    const mockMembership = {
      id: 'mem-1',
      org_id: 'org-aaa-111',
      user_id: 'user-staff-001',
      role: 'staff',
      joined_at: new Date().toISOString(),
    };

    const mockDb = {
      from: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          eq: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({
                data: mockMembership,
                error: null,
              }),
            }),
          }),
        }),
      }),
    };

    const ctx = await getOrgContext(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      mockDb as any,
      'user-staff-001',
    );

    expect(ctx.orgId).toBe('org-aaa-111');
    expect(ctx.role).toBe('staff');
  });
});
