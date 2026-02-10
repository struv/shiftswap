import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Mock Supabase client
// ---------------------------------------------------------------------------

function createMockSupabase() {
  const insertFn = vi.fn().mockResolvedValue({ error: null });
  const fromFn = vi.fn().mockReturnValue({ insert: insertFn });

  return {
    client: { from: fromFn } as unknown,
    fromFn,
    insertFn,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

// Reset module-level ENABLE_EMAIL env before each import
beforeEach(() => {
  vi.clearAllMocks();
  delete process.env.ENABLE_EMAIL;
  vi.resetModules();
});

describe('createNotification', () => {
  it('inserts a notification row into the database', async () => {
    const { createNotification } = await import('../notifications');
    const { client, insertFn } = createMockSupabase();

    await createNotification(client as never, {
      orgId: 'org-1',
      userId: 'user-1',
      type: 'swap_request',
      title: 'New Swap Request',
      message: 'Alice posted a call-out for Jan 15',
      link: '/callouts/abc',
    });

    expect(insertFn).toHaveBeenCalledWith({
      org_id: 'org-1',
      user_id: 'user-1',
      type: 'swap_request',
      title: 'New Swap Request',
      message: 'Alice posted a call-out for Jan 15',
      link: '/callouts/abc',
      read_at: null,
    });
  });

  it('handles missing link gracefully', async () => {
    const { createNotification } = await import('../notifications');
    const { client, insertFn } = createMockSupabase();

    await createNotification(client as never, {
      orgId: 'org-1',
      userId: 'user-1',
      type: 'general',
      title: 'Hello',
      message: 'General notification',
    });

    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({ link: null }),
    );
  });

  it('logs error but does not throw on insert failure', async () => {
    const { createNotification } = await import('../notifications');
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const insertFn = vi.fn().mockResolvedValue({ error: { message: 'insert failed' } });
    const client = { from: vi.fn().mockReturnValue({ insert: insertFn }) };

    await createNotification(client as never, {
      orgId: 'org-1',
      userId: 'user-1',
      type: 'swap_approved',
      title: 'Approved',
      message: 'Swap approved',
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      '[notifications] Failed to create notification:',
      'insert failed',
    );
    consoleSpy.mockRestore();
  });
});

describe('notifySwapRequested', () => {
  it('creates notifications for all managers', async () => {
    const { notifySwapRequested } = await import('../notifications');
    const insertFn = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ insert: insertFn }) };

    await notifySwapRequested(client as never, {
      orgId: 'org-1',
      managerUserIds: ['mgr-1', 'mgr-2'],
      requesterName: 'Alice',
      shiftDate: '2025-01-15',
      calloutId: 'callout-abc',
    });

    expect(insertFn).toHaveBeenCalledTimes(2);
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'mgr-1',
        type: 'swap_request',
        title: 'New Swap Request',
      }),
    );
    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'mgr-2',
        type: 'swap_request',
      }),
    );
  });
});

describe('notifySwapApproved', () => {
  it('creates a notification for the requester', async () => {
    const { notifySwapApproved } = await import('../notifications');
    const insertFn = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ insert: insertFn }) };

    await notifySwapApproved(client as never, {
      orgId: 'org-1',
      requesterUserId: 'user-1',
      shiftDate: '2025-01-15',
      calloutId: 'callout-abc',
    });

    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        type: 'swap_approved',
        title: 'Swap Approved',
        link: '/callouts/callout-abc',
      }),
    );
  });
});

describe('notifySwapDenied', () => {
  it('creates a notification for the requester', async () => {
    const { notifySwapDenied } = await import('../notifications');
    const insertFn = vi.fn().mockResolvedValue({ error: null });
    const client = { from: vi.fn().mockReturnValue({ insert: insertFn }) };

    await notifySwapDenied(client as never, {
      orgId: 'org-1',
      requesterUserId: 'user-1',
      shiftDate: '2025-01-15',
      calloutId: 'callout-abc',
    });

    expect(insertFn).toHaveBeenCalledWith(
      expect.objectContaining({
        user_id: 'user-1',
        type: 'swap_denied',
        title: 'Swap Denied',
      }),
    );
  });
});

describe('sendEmail', () => {
  it('logs the email stub when called', async () => {
    const { sendEmail } = await import('../notifications');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

    await sendEmail({
      to: 'user@test.com',
      template: 'swap_request',
      data: { title: 'Test', message: 'Test message' },
    });

    expect(consoleSpy).toHaveBeenCalledWith(
      '[email-stub] Would send email:',
      expect.objectContaining({
        to: 'user@test.com',
        template: 'swap_request',
      }),
    );
    consoleSpy.mockRestore();
  });

  it('does not send email when ENABLE_EMAIL is not set', async () => {
    const { createNotification } = await import('../notifications');
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    const { client } = createMockSupabase();

    await createNotification(client as never, {
      orgId: 'org-1',
      userId: 'user-1',
      type: 'swap_request',
      title: 'Test',
      message: 'No email',
    });

    // sendEmail should NOT have been called (no email-stub log)
    expect(consoleSpy).not.toHaveBeenCalledWith(
      '[email-stub] Would send email:',
      expect.anything(),
    );
    consoleSpy.mockRestore();
  });
});
