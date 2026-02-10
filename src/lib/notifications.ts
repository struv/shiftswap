/**
 * Notification creation helpers.
 *
 * Used by routers to create notifications when swap events occur.
 * Also triggers email stubs when applicable.
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { NotificationType } from '@/types/database';
import { sendEmail, EmailTemplate } from '@/lib/email';

interface CreateNotificationParams {
  supabase: SupabaseClient;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

/**
 * Create an in-app notification and trigger the email stub.
 * Notification creation errors are logged but not thrown to avoid
 * blocking the primary operation.
 */
export async function createNotification({
  supabase,
  userId,
  type,
  title,
  message,
  link,
}: CreateNotificationParams): Promise<void> {
  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type,
    title,
    message,
    link: link ?? null,
    read_at: null,
  });

  if (error) {
    console.error('[NOTIFICATION] Failed to create notification:', error.message);
  }
}

/**
 * Notify managers in the org about a new swap request.
 */
export async function notifySwapRequested({
  supabase,
  orgId,
  requesterId,
  requesterName,
  shiftDate,
  shiftStartTime,
  shiftEndTime,
  swapId,
}: {
  supabase: SupabaseClient;
  orgId: string;
  requesterId: string;
  requesterName: string;
  shiftDate: string;
  shiftStartTime: string;
  shiftEndTime: string;
  swapId: string;
}): Promise<void> {
  // Find managers/admins in the org
  const { data: managers } = await supabase
    .from('org_members')
    .select('user_id, user:users(email)')
    .eq('org_id', orgId)
    .in('role', ['manager', 'admin'])
    .neq('user_id', requesterId);

  if (!managers || managers.length === 0) return;

  const message = `${requesterName} requested a shift swap for ${shiftDate} (${shiftStartTime} - ${shiftEndTime}).`;

  for (const manager of managers) {
    await createNotification({
      supabase,
      userId: manager.user_id,
      type: 'swap_request',
      title: 'New Swap Request',
      message,
      link: `/swaps/${swapId}`,
    });

    // Trigger email stub
    const email = (manager.user as { email?: string } | null)?.email;
    if (email) {
      await sendEmail(email, 'swap_request' as EmailTemplate, {
        date: shiftDate,
        startTime: shiftStartTime,
        endTime: shiftEndTime,
        requesterName,
      });
    }
  }
}

/**
 * Notify the requester that their swap was approved.
 */
export async function notifySwapApproved({
  supabase,
  requesterId,
  requesterEmail,
  shiftDate,
  shiftStartTime,
  shiftEndTime,
  swapId,
  managerNotes,
}: {
  supabase: SupabaseClient;
  requesterId: string;
  requesterEmail: string;
  shiftDate: string;
  shiftStartTime: string;
  shiftEndTime: string;
  swapId: string;
  managerNotes?: string;
}): Promise<void> {
  const message = `Your shift swap request for ${shiftDate} (${shiftStartTime} - ${shiftEndTime}) has been approved.` +
    (managerNotes ? ` Notes: ${managerNotes}` : '');

  await createNotification({
    supabase,
    userId: requesterId,
    type: 'swap_approved',
    title: 'Swap Request Approved',
    message,
    link: `/swaps/${swapId}`,
  });

  await sendEmail(requesterEmail, 'swap_approved' as EmailTemplate, {
    date: shiftDate,
    startTime: shiftStartTime,
    endTime: shiftEndTime,
    managerNotes: managerNotes ?? '',
  });
}

/**
 * Notify the requester that their swap was denied.
 */
export async function notifySwapDenied({
  supabase,
  requesterId,
  requesterEmail,
  shiftDate,
  shiftStartTime,
  shiftEndTime,
  swapId,
  managerNotes,
}: {
  supabase: SupabaseClient;
  requesterId: string;
  requesterEmail: string;
  shiftDate: string;
  shiftStartTime: string;
  shiftEndTime: string;
  swapId: string;
  managerNotes?: string;
}): Promise<void> {
  const message = `Your shift swap request for ${shiftDate} (${shiftStartTime} - ${shiftEndTime}) has been denied.` +
    (managerNotes ? ` Notes: ${managerNotes}` : '');

  await createNotification({
    supabase,
    userId: requesterId,
    type: 'swap_denied',
    title: 'Swap Request Denied',
    message,
    link: `/swaps/${swapId}`,
  });

  await sendEmail(requesterEmail, 'swap_denied' as EmailTemplate, {
    date: shiftDate,
    startTime: shiftStartTime,
    endTime: shiftEndTime,
    managerNotes: managerNotes ?? '',
  });
}
