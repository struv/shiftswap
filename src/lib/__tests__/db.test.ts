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

// Set DATABASE_URL before importing db module
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/testdb';

// Import after mocks are set up
import { query, withOrgContext, transaction, withOrgTransaction, endPool } from '../db';

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

beforeEach(() => {
  vi.clearAllMocks();
});

afterEach(async () => {
  // Reset pool singleton between tests
  await endPool();
});

describe('query', () => {
  it('executes a query against the pool', async () => {
    mockPoolQuery.mockResolvedValueOnce({ rows: [{ id: '1' }], rowCount: 1 });

    const result = await query('SELECT * FROM users WHERE id = $1', ['1']);

    expect(mockPoolQuery).toHaveBeenCalledWith('SELECT * FROM users WHERE id = $1', ['1']);
    expect(result.rows).toEqual([{ id: '1' }]);
  });

  it('creates the pool lazily with DATABASE_URL', async () => {
    await query('SELECT 1');

    expect(MockPool).toHaveBeenCalledWith(
      expect.objectContaining({
        connectionString: 'postgresql://test:test@localhost:5432/testdb',
      }),
    );
  });

  it('throws when DATABASE_URL is not set', async () => {
    const original = process.env.DATABASE_URL;
    delete process.env.DATABASE_URL;

    await expect(query('SELECT 1')).rejects.toThrow(
      'DATABASE_URL environment variable is not set',
    );

    process.env.DATABASE_URL = original;
  });
});

describe('withOrgContext', () => {
  it('sets app.current_org_id and calls the callback', async () => {
    const orgId = '550e8400-e29b-41d4-a716-446655440000';

    const result = await withOrgContext(orgId, async (client) => {
      const { rows } = await client.query('SELECT * FROM shifts');
      return rows;
    });

    // First call sets the org context
    expect(mockClientQuery).toHaveBeenNthCalledWith(
      1,
      "SELECT set_config('app.current_org_id', $1, false)",
      [orgId],
    );
    // Second call is the user query
    expect(mockClientQuery).toHaveBeenNthCalledWith(2, 'SELECT * FROM shifts');
    expect(result).toEqual([]);
  });

  it('releases the client even if the callback throws', async () => {
    await expect(
      withOrgContext('org-123', async () => {
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');

    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});

describe('transaction', () => {
  it('wraps the callback in BEGIN / COMMIT', async () => {
    await transaction(async (client) => {
      await client.query('INSERT INTO shifts (id) VALUES ($1)', ['s1']);
    });

    expect(mockClientQuery).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockClientQuery).toHaveBeenNthCalledWith(2, 'INSERT INTO shifts (id) VALUES ($1)', [
      's1',
    ]);
    expect(mockClientQuery).toHaveBeenNthCalledWith(3, 'COMMIT');
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('rolls back on error and re-throws', async () => {
    const error = new Error('constraint violation');

    await expect(
      transaction(async () => {
        throw error;
      }),
    ).rejects.toThrow('constraint violation');

    expect(mockClientQuery).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockClientQuery).toHaveBeenNthCalledWith(2, 'ROLLBACK');
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('returns the callback result on success', async () => {
    mockClientQuery.mockResolvedValueOnce(undefined); // BEGIN
    mockClientQuery.mockResolvedValueOnce({ rows: [{ count: 42 }] }); // user query
    mockClientQuery.mockResolvedValueOnce(undefined); // COMMIT

    const result = await transaction(async (client) => {
      const { rows } = await client.query('SELECT count(*) FROM shifts');
      return rows[0].count;
    });

    expect(result).toBe(42);
  });
});

describe('withOrgTransaction', () => {
  it('sets org context inside the transaction with local scope', async () => {
    const orgId = 'org-456';

    await withOrgTransaction(orgId, async (client) => {
      await client.query('UPDATE shifts SET notes = $1 WHERE id = $2', ['updated', 's1']);
    });

    expect(mockClientQuery).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockClientQuery).toHaveBeenNthCalledWith(
      2,
      "SELECT set_config('app.current_org_id', $1, true)",
      [orgId],
    );
    expect(mockClientQuery).toHaveBeenNthCalledWith(
      3,
      'UPDATE shifts SET notes = $1 WHERE id = $2',
      ['updated', 's1'],
    );
    expect(mockClientQuery).toHaveBeenNthCalledWith(4, 'COMMIT');
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });

  it('rolls back on error and releases the client', async () => {
    await expect(
      withOrgTransaction('org-789', async () => {
        throw new Error('tx failure');
      }),
    ).rejects.toThrow('tx failure');

    expect(mockClientQuery).toHaveBeenNthCalledWith(1, 'BEGIN');
    expect(mockClientQuery).toHaveBeenNthCalledWith(
      2,
      "SELECT set_config('app.current_org_id', $1, true)",
      ['org-789'],
    );
    expect(mockClientQuery).toHaveBeenNthCalledWith(3, 'ROLLBACK');
    expect(mockRelease).toHaveBeenCalledTimes(1);
  });
});

describe('endPool', () => {
  it('ends the pool and resets the singleton', async () => {
    // First create a pool by running a query
    await query('SELECT 1');
    expect(MockPool).toHaveBeenCalledTimes(1);

    await endPool();
    expect(mockEnd).toHaveBeenCalledTimes(1);

    // Running another query should create a new pool
    await query('SELECT 1');
    expect(MockPool).toHaveBeenCalledTimes(2);
  });

  it('is a no-op if pool was never created', async () => {
    await endPool();
    expect(mockEnd).not.toHaveBeenCalled();
  });
});
