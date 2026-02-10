import { createClient } from '@/lib/supabase/server';
import { sendEmail } from './email';
import type { Notification } from '@/types/database';

export type NotificationType =
  | 'swap_request_created'
  | 'swap_request_approved'
  | 'swap_request_denied'
  | 'claim_received'
  | 'general';

interface CreateNotificationParams {
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

/**
 * Create an in-app notification for a user.
 * Also attempts to send email if the feature flag is enabled.
 */
export async function createNotification(params: CreateNotificationParams) {
  const supabase = await createClient();

  const { error } = await (supabase.from('notifications') as any).insert({
    user_id: params.userId,
    type: params.type,
    title: params.title,
    message: params.message,
    link: params.link ?? null,
  } satisfies Omit<Notification, 'id' | 'created_at' | 'read_at'>);

  if (error) {
    console.error('Failed to create notification:', error);
    throw error;
  }

  // Attempt email notification (feature-flagged)
  const { data: user } = await supabase
    .from('users')
    .select('email, name')
    .eq('id', params.userId)
    .single() as { data: { email: string; name: string } | null };

  if (user?.email) {
    const templateMap: Record<string, string> = {
      swap_request_created: 'swap_request',
      swap_request_approved: 'swap_approved',
      swap_request_denied: 'swap_denied',
    };

    const template = templateMap[params.type];
    if (template) {
      await sendEmail(user.email, template, {
        userName: user.name,
        title: params.title,
        message: params.message,
        link: params.link,
      });
    }
  }
}

/**
 * Notify the manager(s) of a department when a swap request is created.
 */
export async function notifySwapRequestCreated(params: {
  requesterId: string;
  requesterName: string;
  shiftDate: string;
  shiftTime: string;
  calloutId: string;
}) {
  const supabase = await createClient();

  // Find managers in the same department as the requester
  const { data: requester } = await supabase
    .from('users')
    .select('department')
    .eq('id', params.requesterId)
    .single() as { data: { department: string | null } | null };

  let managerQuery = supabase
    .from('users')
    .select('id')
    .in('role', ['manager', 'admin']);

  if (requester?.department) {
    managerQuery = managerQuery.eq('department', requester.department);
  }

  const { data: managers } = await managerQuery as { data: { id: string }[] | null };

  if (managers) {
    for (const manager of managers) {
      await createNotification({
        userId: manager.id,
        type: 'swap_request_created',
        title: 'New Shift Call-Out',
        message: `${params.requesterName} posted a call-out for ${params.shiftDate} (${params.shiftTime})`,
        link: `/callouts`,
      });
    }
  }
}

/**
 * Notify the requester when their swap request is approved.
 */
export async function notifySwapApproved(params: {
  requesterId: string;
  claimerName: string;
  shiftDate: string;
  calloutId: string;
}) {
  await createNotification({
    userId: params.requesterId,
    type: 'swap_request_approved',
    title: 'Call-Out Approved',
    message: `Your call-out for ${params.shiftDate} has been approved. ${params.claimerName} will cover your shift.`,
    link: `/callouts`,
  });
}

/**
 * Notify the requester when their swap request is denied.
 */
export async function notifySwapDenied(params: {
  requesterId: string;
  shiftDate: string;
  calloutId: string;
}) {
  await createNotification({
    userId: params.requesterId,
    type: 'swap_request_denied',
    title: 'Call-Out Denied',
    message: `Your call-out for ${params.shiftDate} has been denied. Please contact your manager for details.`,
    link: `/callouts`,
  });
}

/**
 * Notify the original requester when someone claims their callout.
 */
export async function notifyClaimReceived(params: {
  requesterId: string;
  claimerName: string;
  shiftDate: string;
  calloutId: string;
}) {
  await createNotification({
    userId: params.requesterId,
    type: 'claim_received',
    title: 'Someone Wants Your Shift',
    message: `${params.claimerName} has offered to cover your shift on ${params.shiftDate}. A manager will review.`,
    link: `/callouts`,
  });
}
