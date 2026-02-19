/**
 * Notification creation helpers.
 *
 * Used by routers to create notifications when swap events occur.
 * Also triggers email stubs when applicable.
 */
import { DbClient } from '@/lib/db-client';
import { NotificationType } from '@/types/database';
import { sendEmail, EmailTemplate } from '@/lib/email';

interface CreateNotificationParams {
  db: DbClient;
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
  db,
  userId,
  type,
  title,
  message,
  link,
}: CreateNotificationParams): Promise<void> {
  const { error } = await db.from('notifications').insert({
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
  db,
  orgId,
  requesterId,
  requesterName,
  shiftDate,
  shiftStartTime,
  shiftEndTime,
  swapId,
}: {
  db: DbClient;
  orgId: string;
  requesterId: string;
  requesterName: string;
  shiftDate: string;
  shiftStartTime: string;
  shiftEndTime: string;
  swapId: string;
}): Promise<void> {
  // Find managers/admins in the org
  const { data: managers } = await db
    .from('org_members')
    .select('user_id')
    .eq('org_id', orgId)
    .in('role', ['manager', 'admin'])
    .neq('user_id', requesterId);

  if (!managers || managers.length === 0) return;

  const message = `${requesterName} requested a shift swap for ${shiftDate} (${shiftStartTime} - ${shiftEndTime}).`;

  for (const manager of managers) {
    await createNotification({
      db,
      userId: manager.user_id,
      type: 'swap_request',
      title: 'New Swap Request',
      message,
      link: `/swaps/${swapId}`,
    });

    // Fetch manager email for email notification
    const { data: managerUser } = await db
      .from('users')
      .select('email')
      .eq('id', manager.user_id)
      .single();

    if (managerUser?.email) {
      await sendEmail(managerUser.email, 'swap_request' as EmailTemplate, {
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
  db,
  requesterId,
  requesterEmail,
  shiftDate,
  shiftStartTime,
  shiftEndTime,
  swapId,
  managerNotes,
}: {
  db: DbClient;
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
    db,
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
 * Notify managers that a callout has been claimed by a staff member.
 */
export async function notifyCalloutClaimed({
  db,
  orgId,
  claimantId,
  claimantName,
  callerName,
  shiftDate,
  shiftStartTime,
  shiftEndTime,
  calloutId,
}: {
  db: DbClient;
  orgId: string;
  claimantId: string;
  claimantName: string;
  callerName: string;
  shiftDate: string;
  shiftStartTime: string;
  shiftEndTime: string;
  calloutId: string;
}): Promise<void> {
  const { data: managers } = await db
    .from('org_members')
    .select('user_id')
    .eq('org_id', orgId)
    .in('role', ['manager', 'admin'])
    .neq('user_id', claimantId);

  if (!managers || managers.length === 0) return;

  const message = `${claimantName} claimed ${callerName}'s callout for ${shiftDate} (${shiftStartTime} - ${shiftEndTime}).`;

  for (const manager of managers) {
    await createNotification({
      db,
      userId: manager.user_id,
      type: 'callout_claimed',
      title: 'Shift Claimed',
      message,
      link: `/callouts`,
    });
  }
}

/**
 * Notify the claimant that their shift claim was approved.
 */
export async function notifyClaimApproved({
  db,
  claimantId,
  claimantEmail,
  shiftDate,
  shiftStartTime,
  shiftEndTime,
}: {
  db: DbClient;
  claimantId: string;
  claimantEmail: string;
  shiftDate: string;
  shiftStartTime: string;
  shiftEndTime: string;
}): Promise<void> {
  const message = `Your claim for the shift on ${shiftDate} (${shiftStartTime} - ${shiftEndTime}) has been approved. The shift is now assigned to you.`;

  await createNotification({
    db,
    userId: claimantId,
    type: 'claim_approved',
    title: 'Claim Approved',
    message,
    link: '/claims',
  });

  await sendEmail(claimantEmail, 'claim_approved' as EmailTemplate, {
    date: shiftDate,
    startTime: shiftStartTime,
    endTime: shiftEndTime,
  });
}

/**
 * Notify the claimant that their shift claim was rejected.
 */
export async function notifyClaimRejected({
  db,
  claimantId,
  claimantEmail,
  shiftDate,
  shiftStartTime,
  shiftEndTime,
}: {
  db: DbClient;
  claimantId: string;
  claimantEmail: string;
  shiftDate: string;
  shiftStartTime: string;
  shiftEndTime: string;
}): Promise<void> {
  const message = `Your claim for the shift on ${shiftDate} (${shiftStartTime} - ${shiftEndTime}) has been denied.`;

  await createNotification({
    db,
    userId: claimantId,
    type: 'claim_rejected',
    title: 'Claim Denied',
    message,
    link: '/claims',
  });

  await sendEmail(claimantEmail, 'claim_rejected' as EmailTemplate, {
    date: shiftDate,
    startTime: shiftStartTime,
    endTime: shiftEndTime,
  });
}

/**
 * Notify the requester that their swap was denied.
 */
export async function notifySwapDenied({
  db,
  requesterId,
  requesterEmail,
  shiftDate,
  shiftStartTime,
  shiftEndTime,
  swapId,
  managerNotes,
}: {
  db: DbClient;
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
    db,
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
