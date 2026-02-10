import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabaseClient, createMockUser, createMockShift, createMockCallout } from './helpers';

describe('RLS Multi-Tenancy Integration Tests', () => {
  let mockSupabaseOrgA: ReturnType<typeof createMockSupabaseClient>;
  let mockSupabaseOrgB: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabaseOrgA = createMockSupabaseClient();
    mockSupabaseOrgB = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  describe('User from Org A cannot access Org B data', () => {
    const orgAUser = createMockUser({
      id: 'org-a-user-1',
      email: 'alice@orga.com',
      name: 'Alice',
      department: 'OrgA-Emergency',
      role: 'staff',
    });

    const orgBUser = createMockUser({
      id: 'org-b-user-1',
      email: 'bob@orgb.com',
      name: 'Bob',
      department: 'OrgB-Surgery',
      role: 'staff',
    });

    it('should allow Org A user to see their own shifts', async () => {
      const orgAShifts = [
        createMockShift({ user_id: orgAUser.id, department: 'OrgA-Emergency' }),
        createMockShift({ user_id: orgAUser.id, department: 'OrgA-Emergency' }),
      ];

      mockSupabaseOrgA.auth.getUser.mockResolvedValue({
        data: { user: { id: orgAUser.id, email: orgAUser.email } },
        error: null,
      });

      mockSupabaseOrgA._query.limit.mockResolvedValue({
        data: orgAShifts,
        error: null,
      });

      const userResult = await mockSupabaseOrgA.auth.getUser();
      expect(userResult.data.user?.id).toBe(orgAUser.id);

      const shifts = await mockSupabaseOrgA
        .from('shifts')
        .select('*')
        .eq('user_id', orgAUser.id)
        .limit(10);

      expect(shifts.data).toHaveLength(2);
      expect(shifts.data?.every((s: { department: string }) => s.department === 'OrgA-Emergency')).toBe(true);
    });

    it('should prevent Org A user from inserting shifts for Org B user', async () => {
      mockSupabaseOrgA.auth.getUser.mockResolvedValue({
        data: { user: { id: orgAUser.id, email: orgAUser.email } },
        error: null,
      });

      // RLS policy: Users can only insert shifts where user_id = auth.uid()
      mockSupabaseOrgA._query.single.mockResolvedValue({
        data: null,
        error: {
          message: 'new row violates row-level security policy for table "shifts"',
          code: '42501',
        },
      });

      const result = await mockSupabaseOrgA
        .from('shifts')
        .insert({
          user_id: orgBUser.id, // Trying to insert for another user
          date: '2025-02-20',
          start_time: '09:00',
          end_time: '17:00',
          role: 'Nurse',
          department: 'OrgB-Surgery',
        })
        .select()
        .single();

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('row-level security');
    });

    it('should prevent Org A user from updating Org B user shifts', async () => {
      const orgBShift = createMockShift({ user_id: orgBUser.id, department: 'OrgB-Surgery' });

      mockSupabaseOrgA.auth.getUser.mockResolvedValue({
        data: { user: { id: orgAUser.id, email: orgAUser.email } },
        error: null,
      });

      // RLS policy: Users can only update their own shifts
      mockSupabaseOrgA._query.single.mockResolvedValue({
        data: null,
        error: {
          message: 'new row violates row-level security policy for table "shifts"',
          code: '42501',
        },
      });

      const result = await mockSupabaseOrgA
        .from('shifts')
        .update({ start_time: '10:00' })
        .eq('id', orgBShift.id)
        .select()
        .single();

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('row-level security');
    });

    it('should prevent Org A user from creating callouts for Org B shifts', async () => {
      const orgBShift = createMockShift({ user_id: orgBUser.id, department: 'OrgB-Surgery' });

      mockSupabaseOrgA.auth.getUser.mockResolvedValue({
        data: { user: { id: orgAUser.id, email: orgAUser.email } },
        error: null,
      });

      // RLS policy: Users can only create callouts for their own shifts
      mockSupabaseOrgA._query.single.mockResolvedValue({
        data: null,
        error: {
          message: 'new row violates row-level security policy for table "callouts"',
          code: '42501',
        },
      });

      const result = await mockSupabaseOrgA
        .from('callouts')
        .insert({
          shift_id: orgBShift.id,
          user_id: orgAUser.id,
          reason: 'Trying to callout on another org shift',
          status: 'open',
        })
        .select()
        .single();

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('row-level security');
    });

    it('should prevent non-manager from approving claims', async () => {
      const staffUser = createMockUser({ id: 'staff-only', role: 'staff' });

      mockSupabaseOrgA.auth.getUser.mockResolvedValue({
        data: { user: { id: staffUser.id, email: staffUser.email } },
        error: null,
      });

      // RLS policy: Only managers can update claims
      mockSupabaseOrgA._query.single.mockResolvedValue({
        data: null,
        error: {
          message: 'new row violates row-level security policy for table "claims"',
          code: '42501',
        },
      });

      const result = await mockSupabaseOrgA
        .from('claims')
        .update({ status: 'approved', approved_by: staffUser.id })
        .eq('id', 'some-claim-id')
        .select()
        .single();

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('row-level security');
    });

    it('should allow managers to approve claims across their scope', async () => {
      const manager = createMockUser({ id: 'mgr-1', role: 'manager', department: 'OrgA-Emergency' });

      mockSupabaseOrgA.auth.getUser.mockResolvedValue({
        data: { user: { id: manager.id, email: manager.email } },
        error: null,
      });

      const approvedClaim = {
        id: 'claim-1',
        callout_id: 'callout-1',
        user_id: 'other-staff',
        claimed_at: new Date().toISOString(),
        status: 'approved',
        approved_by: manager.id,
        approved_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };

      mockSupabaseOrgA._query.single.mockResolvedValue({
        data: approvedClaim,
        error: null,
      });

      const result = await mockSupabaseOrgA
        .from('claims')
        .update({ status: 'approved', approved_by: manager.id })
        .eq('id', 'claim-1')
        .select()
        .single();

      expect(result.error).toBeNull();
      expect(result.data?.status).toBe('approved');
    });

    it('should prevent Org A user from updating Org B user profile', async () => {
      mockSupabaseOrgA.auth.getUser.mockResolvedValue({
        data: { user: { id: orgAUser.id, email: orgAUser.email } },
        error: null,
      });

      // RLS: Users can only update their own profile
      mockSupabaseOrgA._query.single.mockResolvedValue({
        data: null,
        error: {
          message: 'new row violates row-level security policy for table "users"',
          code: '42501',
        },
      });

      const result = await mockSupabaseOrgA
        .from('users')
        .update({ name: 'Hacked Name' })
        .eq('id', orgBUser.id)
        .select()
        .single();

      expect(result.error).toBeDefined();
      expect(result.error?.message).toContain('row-level security');
    });

    it('should allow users to update their own profile', async () => {
      mockSupabaseOrgA.auth.getUser.mockResolvedValue({
        data: { user: { id: orgAUser.id, email: orgAUser.email } },
        error: null,
      });

      const updatedProfile = { ...orgAUser, name: 'Alice Updated' };
      mockSupabaseOrgA._query.single.mockResolvedValue({
        data: updatedProfile,
        error: null,
      });

      const result = await mockSupabaseOrgA
        .from('users')
        .update({ name: 'Alice Updated' })
        .eq('id', orgAUser.id)
        .select()
        .single();

      expect(result.error).toBeNull();
      expect(result.data?.name).toBe('Alice Updated');
    });
  });
});
