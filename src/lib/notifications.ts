/**
 * Notification service — creates in-app notifications and stubs email sending.
 *
 * Notification triggers fire when swap events occur (request created,
 * approved, denied). Email sending is feature-flagged OFF by default.
 */
import { SupabaseClient } from '@supabase/supabase-js';
import { NotificationType } from '@/types/database';

// ---------------------------------------------------------------------------
// Feature flag for email sending
// ---------------------------------------------------------------------------

const ENABLE_EMAIL = process.env.ENABLE_EMAIL === 'true';

// ---------------------------------------------------------------------------
// Core: create a notification row
// ---------------------------------------------------------------------------

interface CreateNotificationParams {
  orgId: string;
  userId: string;
  type: NotificationType;
  title: string;
  message: string;
  link?: string;
}

/**
 * Insert a notification into the database for a specific user.
 * Also triggers a stubbed email if the feature flag is enabled.
 */
export async function createNotification(
  supabase: SupabaseClient,
  params: CreateNotificationParams,
): Promise<void> {
  const { orgId, userId, type, title, message, link } = params;

  const { error } = await supabase.from('notifications').insert({
    org_id: orgId,
    user_id: userId,
    type,
    title,
    message,
    link: link ?? null,
    read_at: null,
  });

  if (error) {
    console.error('[notifications] Failed to create notification:', error.message);
  }

  // Attempt email (stubbed, feature-flagged OFF by default)
  if (ENABLE_EMAIL) {
    const templateMap: Record<NotificationType, string> = {
      swap_request: 'swap_request',
      swap_approved: 'swap_approved',
      swap_denied: 'swap_denied',
      shift_claimed: 'shift_claimed',
      general: 'general',
    };

    await sendEmail({
      to: userId, // In a real implementation, resolve to email address
      template: templateMap[type],
      data: { title, message, link },
    });
  }
}

// ---------------------------------------------------------------------------
// Swap event triggers
// ---------------------------------------------------------------------------

/**
 * Notify managers when a swap request (callout) is created.
 */
export async function notifySwapRequested(
  supabase: SupabaseClient,
  params: {
    orgId: string;
    managerUserIds: string[];
    requesterName: string;
    shiftDate: string;
    calloutId: string;
  },
): Promise<void> {
  const { orgId, managerUserIds, requesterName, shiftDate, calloutId } = params;

  await Promise.all(
    managerUserIds.map((managerId) =>
      createNotification(supabase, {
        orgId,
        userId: managerId,
        type: 'swap_request',
        title: 'New Swap Request',
        message: `${requesterName} posted a call-out for ${shiftDate}`,
        link: `/callouts/${calloutId}`,
      }),
    ),
  );
}

/**
 * Notify the requester when their swap is approved.
 */
export async function notifySwapApproved(
  supabase: SupabaseClient,
  params: {
    orgId: string;
    requesterUserId: string;
    shiftDate: string;
    calloutId: string;
  },
): Promise<void> {
  const { orgId, requesterUserId, shiftDate, calloutId } = params;

  await createNotification(supabase, {
    orgId,
    userId: requesterUserId,
    type: 'swap_approved',
    title: 'Swap Approved',
    message: `Your call-out for ${shiftDate} has been approved`,
    link: `/callouts/${calloutId}`,
  });
}

/**
 * Notify the requester when their swap is denied.
 */
export async function notifySwapDenied(
  supabase: SupabaseClient,
  params: {
    orgId: string;
    requesterUserId: string;
    shiftDate: string;
    calloutId: string;
  },
): Promise<void> {
  const { orgId, requesterUserId, shiftDate, calloutId } = params;

  await createNotification(supabase, {
    orgId,
    userId: requesterUserId,
    type: 'swap_denied',
    title: 'Swap Denied',
    message: `Your call-out for ${shiftDate} has been denied`,
    link: `/callouts/${calloutId}`,
  });
}

// ---------------------------------------------------------------------------
// Email stub (feature-flagged OFF)
// ---------------------------------------------------------------------------

interface SendEmailParams {
  to: string;
  template: string;
  data: Record<string, unknown>;
}

/**
 * Stubbed email sending function.
 *
 * Currently logs to console. When ENABLE_EMAIL=true, this will be called
 * but still only logs — the actual email provider (e.g. Resend) needs to
 * be integrated.
 *
 * TODO: Integrate Resend or Supabase edge function for actual email delivery.
 * Email templates needed: swap_request.html, swap_approved.html, swap_denied.html
 */
export async function sendEmail(params: SendEmailParams): Promise<void> {
  console.log('[email-stub] Would send email:', {
    to: params.to,
    template: params.template,
    data: params.data,
  });

  // TODO: Replace with actual email provider integration
  // Example with Resend:
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: 'ShiftSwap <notifications@shiftswap.app>',
  //   to: params.to,
  //   subject: params.data.title,
  //   html: renderTemplate(params.template, params.data),
  // });
}
