import { vi } from 'vitest';
import type { User, Shift, CallOut, Claim } from '@/types/database';

// Mock user factory
export function createMockUser(overrides: Partial<User> = {}): User {
  return {
    id: crypto.randomUUID(),
    email: 'test@example.com',
    name: 'Test User',
    phone: null,
    role: 'staff',
    department: 'Engineering',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// Mock shift factory
export function createMockShift(overrides: Partial<Shift> = {}): Shift {
  return {
    id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    date: '2025-01-15',
    start_time: '09:00',
    end_time: '17:00',
    role: 'Nurse',
    department: 'Emergency',
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// Mock callout factory
export function createMockCallout(overrides: Partial<CallOut> = {}): CallOut {
  return {
    id: crypto.randomUUID(),
    shift_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    reason: 'Sick',
    posted_at: new Date().toISOString(),
    status: 'open',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    ...overrides,
  };
}

// Mock claim factory
export function createMockClaim(overrides: Partial<Claim> = {}): Claim {
  return {
    id: crypto.randomUUID(),
    callout_id: crypto.randomUUID(),
    user_id: crypto.randomUUID(),
    claimed_at: new Date().toISOString(),
    status: 'pending',
    approved_by: null,
    approved_at: null,
    created_at: new Date().toISOString(),
    ...overrides,
  };
}

// Create a mock Supabase client for testing
export function createMockSupabaseClient() {
  const mockQuery = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    lte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    then: vi.fn(),
    data: null,
    error: null,
  };

  return {
    from: vi.fn(() => mockQuery),
    auth: {
      signUp: vi.fn(),
      signInWithPassword: vi.fn(),
      signOut: vi.fn(),
      getUser: vi.fn(),
      getSession: vi.fn(),
      exchangeCodeForSession: vi.fn(),
    },
    _query: mockQuery,
  };
}
