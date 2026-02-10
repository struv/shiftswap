/**
 * Email notification stub (feature-flagged OFF).
 *
 * This module provides a stubbed email sending function that logs
 * instead of sending actual emails. Enable by setting ENABLE_EMAIL=true.
 *
 * TODO: Integrate Resend or other email provider for actual email delivery.
 */

const ENABLE_EMAIL = process.env.ENABLE_EMAIL === 'true';

/** Email template identifiers */
export type EmailTemplate = 'swap_request' | 'swap_approved' | 'swap_denied';

/** Email template subjects */
const templateSubjects: Record<EmailTemplate, string> = {
  swap_request: 'New Shift Swap Request',
  swap_approved: 'Your Shift Swap Was Approved',
  swap_denied: 'Your Shift Swap Was Denied',
};

/** Email template body generators */
const templateBodies: Record<EmailTemplate, (data: Record<string, string>) => string> = {
  swap_request: (data) =>
    `A new swap request has been submitted for the shift on ${data.date || 'N/A'} (${data.startTime || ''} - ${data.endTime || ''}).` +
    `\n\nRequested by: ${data.requesterName || 'Unknown'}` +
    `\n\nPlease review and approve or deny this request.`,
  swap_approved: (data) =>
    `Your shift swap request for ${data.date || 'N/A'} (${data.startTime || ''} - ${data.endTime || ''}) has been approved.` +
    (data.managerNotes ? `\n\nManager notes: ${data.managerNotes}` : ''),
  swap_denied: (data) =>
    `Your shift swap request for ${data.date || 'N/A'} (${data.startTime || ''} - ${data.endTime || ''}) has been denied.` +
    (data.managerNotes ? `\n\nManager notes: ${data.managerNotes}` : ''),
};

/**
 * Send an email notification (stubbed).
 *
 * When ENABLE_EMAIL is false (default), this logs the email details
 * and returns without sending. When enabled, it will integrate with
 * an email provider.
 */
export async function sendEmail(
  to: string,
  template: EmailTemplate,
  data: Record<string, string>
): Promise<void> {
  const subject = templateSubjects[template];
  const body = templateBodies[template](data);

  if (!ENABLE_EMAIL) {
    console.log('[EMAIL STUB] Would send email:', { to, subject, body });
    return;
  }

  // TODO: Integrate Resend or other email provider here
  // Example with Resend:
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: 'ShiftSwap <notifications@shiftswap.app>',
  //   to,
  //   subject,
  //   text: body,
  // });
  console.log('[EMAIL] Sending email:', { to, subject });
}
