/**
 * Email notification stub (feature-flagged OFF by default).
 *
 * This module provides a stubbed email sending function that logs
 * email attempts but does not actually send emails unless the
 * ENABLE_EMAIL environment variable is set to "true".
 *
 * TODO: Integrate Resend or Supabase edge function for actual email delivery
 */

const ENABLE_EMAIL = process.env.ENABLE_EMAIL === 'true';

export interface EmailData {
  userName: string;
  title: string;
  message: string;
  link?: string;
}

/**
 * Email templates (stubbed).
 * In production, these would be HTML templates rendered with a template engine.
 */
const EMAIL_TEMPLATES: Record<string, (data: EmailData) => { subject: string; body: string }> = {
  swap_request: (data) => ({
    subject: `ShiftSwap: New Call-Out Request`,
    body: `
      <h2>New Call-Out Request</h2>
      <p>Hi ${data.userName},</p>
      <p>${data.message}</p>
      ${data.link ? `<p><a href="${data.link}">View Details</a></p>` : ''}
      <p>- ShiftSwap Team</p>
    `.trim(),
  }),

  swap_approved: (data) => ({
    subject: `ShiftSwap: Your Call-Out Was Approved`,
    body: `
      <h2>Call-Out Approved</h2>
      <p>Hi ${data.userName},</p>
      <p>${data.message}</p>
      ${data.link ? `<p><a href="${data.link}">View Details</a></p>` : ''}
      <p>- ShiftSwap Team</p>
    `.trim(),
  }),

  swap_denied: (data) => ({
    subject: `ShiftSwap: Your Call-Out Was Denied`,
    body: `
      <h2>Call-Out Denied</h2>
      <p>Hi ${data.userName},</p>
      <p>${data.message}</p>
      ${data.link ? `<p><a href="${data.link}">View Details</a></p>` : ''}
      <p>- ShiftSwap Team</p>
    `.trim(),
  }),
};

/**
 * Send an email notification (stubbed).
 *
 * When ENABLE_EMAIL is false (default), this function only logs the email
 * attempt. When enabled, it would send the email via the configured provider.
 *
 * @param to - Recipient email address
 * @param template - Template name (swap_request, swap_approved, swap_denied)
 * @param data - Template data
 */
export async function sendEmail(
  to: string,
  template: string,
  data: EmailData
): Promise<void> {
  const templateFn = EMAIL_TEMPLATES[template];
  if (!templateFn) {
    console.warn(`[Email] Unknown template: ${template}`);
    return;
  }

  const { subject, body } = templateFn(data);

  if (!ENABLE_EMAIL) {
    console.log(`[Email Stub] Would send email to ${to}:`);
    console.log(`  Subject: ${subject}`);
    console.log(`  Body length: ${body.length} chars`);
    return;
  }

  // TODO: Integrate Resend or Supabase edge function
  // Example with Resend:
  //
  // import { Resend } from 'resend';
  // const resend = new Resend(process.env.RESEND_API_KEY);
  //
  // await resend.emails.send({
  //   from: 'ShiftSwap <notifications@yourdomain.com>',
  //   to,
  //   subject,
  //   html: body,
  // });

  console.log(`[Email] Sending email to ${to}: ${subject}`);
}
