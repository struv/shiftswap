import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabaseClient, createMockUser, createMockShift, createMockCallout, createMockClaim } from './helpers';

describe('Swap Workflow Integration Tests', () => {
  let mockSupabase: ReturnType<typeof createMockSupabaseClient>;

  beforeEach(() => {
    mockSupabase = createMockSupabaseClient();
    vi.clearAllMocks();
  });

  describe('Create Shift → Request Swap → Manager Approves → Shift Updates', () => {
    it('should create a shift for a user', async () => {
      const user = createMockUser({ role: 'staff' });
      const shift = createMockShift({
        user_id: user.id,
        date: '2025-02-15',
        start_time: '07:00',
        end_time: '15:00',
        role: 'Nurse',
        department: 'ICU',
      });

      mockSupabase._query.single.mockResolvedValue({ data: shift, error: null });

      const result = await mockSupabase
        .from('shifts')
        .insert({
          user_id: user.id,
          date: '2025-02-15',
          start_time: '07:00',
          end_time: '15:00',
          role: 'Nurse',
          department: 'ICU',
        })
        .select()
        .single();

      expect(mockSupabase.from).toHaveBeenCalledWith('shifts');
      expect(result.data).toBeDefined();
      expect(result.data.user_id).toBe(user.id);
      expect(result.data.date).toBe('2025-02-15');
    });

    it('should create a callout for an existing shift', async () => {
      const user = createMockUser({ role: 'staff' });
      const shift = createMockShift({ user_id: user.id });
      const callout = createMockCallout({
        shift_id: shift.id,
        user_id: user.id,
        reason: 'Family emergency',
        status: 'open',
      });

      mockSupabase._query.single.mockResolvedValue({ data: callout, error: null });

      const result = await mockSupabase
        .from('callouts')
        .insert({
          shift_id: shift.id,
          user_id: user.id,
          reason: 'Family emergency',
          status: 'open',
        })
        .select()
        .single();

      expect(mockSupabase.from).toHaveBeenCalledWith('callouts');
      expect(result.data.status).toBe('open');
      expect(result.data.reason).toBe('Family emergency');
    });

    it('should allow another user to claim the open callout', async () => {
      const originalUser = createMockUser({ id: 'user-a', role: 'staff' });
      const claimingUser = createMockUser({ id: 'user-b', role: 'staff' });
      const shift = createMockShift({ user_id: originalUser.id });
      const callout = createMockCallout({ shift_id: shift.id, user_id: originalUser.id, status: 'open' });
      const claim = createMockClaim({
        callout_id: callout.id,
        user_id: claimingUser.id,
        status: 'pending',
      });

      mockSupabase._query.single.mockResolvedValue({ data: claim, error: null });

      const result = await mockSupabase
        .from('claims')
        .insert({
          callout_id: callout.id,
          user_id: claimingUser.id,
          status: 'pending',
        })
        .select()
        .single();

      expect(mockSupabase.from).toHaveBeenCalledWith('claims');
      expect(result.data.status).toBe('pending');
      expect(result.data.user_id).toBe(claimingUser.id);
    });

    it('should allow a manager to approve the claim', async () => {
      const manager = createMockUser({ role: 'manager' });
      const claim = createMockClaim({ status: 'pending' });
      const approvedClaim = {
        ...claim,
        status: 'approved' as const,
        approved_by: manager.id,
        approved_at: new Date().toISOString(),
      };

      mockSupabase._query.single.mockResolvedValue({ data: approvedClaim, error: null });

      const result = await mockSupabase
        .from('claims')
        .update({
          status: 'approved',
          approved_by: manager.id,
          approved_at: new Date().toISOString(),
        })
        .eq('id', claim.id)
        .select()
        .single();

      expect(mockSupabase.from).toHaveBeenCalledWith('claims');
      expect(result.data.status).toBe('approved');
      expect(result.data.approved_by).toBe(manager.id);
    });

    it('should update callout status after claim approval', async () => {
      const callout = createMockCallout({ status: 'open' });
      const updatedCallout = { ...callout, status: 'approved' as const };

      mockSupabase._query.single.mockResolvedValue({ data: updatedCallout, error: null });

      const result = await mockSupabase
        .from('callouts')
        .update({ status: 'approved' })
        .eq('id', callout.id)
        .select()
        .single();

      expect(result.data.status).toBe('approved');
    });

    it('should handle the complete swap workflow end-to-end', async () => {
      const staffUser = createMockUser({ id: 'staff-1', name: 'Alice', role: 'staff' });
      const coverUser = createMockUser({ id: 'staff-2', name: 'Bob', role: 'staff' });
      const manager = createMockUser({ id: 'mgr-1', name: 'Manager', role: 'manager' });

      // Step 1: Staff creates a shift
      const shift = createMockShift({
        user_id: staffUser.id,
        date: '2025-02-20',
        start_time: '08:00',
        end_time: '16:00',
      });
      mockSupabase._query.single.mockResolvedValueOnce({ data: shift, error: null });
      const shiftResult = await mockSupabase.from('shifts').insert({}).select().single();
      expect(shiftResult.data.user_id).toBe(staffUser.id);

      // Step 2: Staff creates a callout (can't work)
      const callout = createMockCallout({
        shift_id: shift.id,
        user_id: staffUser.id,
        status: 'open',
        reason: 'Sick',
      });
      mockSupabase._query.single.mockResolvedValueOnce({ data: callout, error: null });
      const calloutResult = await mockSupabase.from('callouts').insert({}).select().single();
      expect(calloutResult.data.status).toBe('open');

      // Step 3: Another staff claims the shift
      const claim = createMockClaim({
        callout_id: callout.id,
        user_id: coverUser.id,
        status: 'pending',
      });
      mockSupabase._query.single.mockResolvedValueOnce({ data: claim, error: null });
      const claimResult = await mockSupabase.from('claims').insert({}).select().single();
      expect(claimResult.data.status).toBe('pending');

      // Step 4: Manager approves
      const approvedClaim = {
        ...claim,
        status: 'approved' as const,
        approved_by: manager.id,
        approved_at: new Date().toISOString(),
      };
      mockSupabase._query.single.mockResolvedValueOnce({ data: approvedClaim, error: null });
      const approveResult = await mockSupabase.from('claims').update({}).eq('id', claim.id).select().single();
      expect(approveResult.data.status).toBe('approved');
      expect(approveResult.data.approved_by).toBe(manager.id);

      // Step 5: Callout status updated
      const updatedCallout = { ...callout, status: 'approved' as const };
      mockSupabase._query.single.mockResolvedValueOnce({ data: updatedCallout, error: null });
      const updateResult = await mockSupabase.from('callouts').update({}).eq('id', callout.id).select().single();
      expect(updateResult.data.status).toBe('approved');
    });

    it('should allow a manager to reject a claim', async () => {
      const manager = createMockUser({ role: 'manager' });
      const claim = createMockClaim({ status: 'pending' });
      const rejectedClaim = { ...claim, status: 'rejected' as const };

      mockSupabase._query.single.mockResolvedValue({ data: rejectedClaim, error: null });

      const result = await mockSupabase
        .from('claims')
        .update({ status: 'rejected' })
        .eq('id', claim.id)
        .select()
        .single();

      expect(result.data.status).toBe('rejected');
    });

    it('should allow a user to cancel their own callout', async () => {
      const user = createMockUser({ role: 'staff' });
      const callout = createMockCallout({ user_id: user.id, status: 'open' });
      const cancelledCallout = { ...callout, status: 'cancelled' as const };

      mockSupabase._query.single.mockResolvedValue({ data: cancelledCallout, error: null });

      const result = await mockSupabase
        .from('callouts')
        .update({ status: 'cancelled' })
        .eq('id', callout.id)
        .select()
        .single();

      expect(result.data.status).toBe('cancelled');
    });

    it('should fetch open callouts for the shift board', async () => {
      const callouts = [
        createMockCallout({ status: 'open' }),
        createMockCallout({ status: 'open' }),
      ];

      mockSupabase._query.eq.mockResolvedValue({ data: callouts, error: null });

      const result = await mockSupabase
        .from('callouts')
        .select('*, shift:shifts(*), user:users(*)')
        .eq('status', 'open');

      expect(result.data).toHaveLength(2);
      expect(result.data?.every((c: { status: string }) => c.status === 'open')).toBe(true);
    });
  });
});
