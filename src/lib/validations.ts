import { z } from 'zod';

// ---------------------------------------------------------------------------
// Auth form schemas
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export const signupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  email: z.string().email('Invalid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;

// ---------------------------------------------------------------------------
// Shift schemas
// ---------------------------------------------------------------------------

const timeRegex = /^\d{2}:\d{2}$/;
const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

export const shiftSchema = z.object({
  user_id: z.string().uuid('Invalid user ID'),
  date: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD'),
  start_time: z.string().regex(timeRegex, 'Start time must be HH:MM'),
  end_time: z.string().regex(timeRegex, 'End time must be HH:MM'),
  role: z.string().min(1, 'Role is required'),
  department: z.string().min(1, 'Department is required'),
});

export type ShiftInput = z.infer<typeof shiftSchema>;

// ---------------------------------------------------------------------------
// CSV import row schema
// ---------------------------------------------------------------------------

export const csvShiftRowSchema = z.object({
  email: z.string().email('Invalid email'),
  date: z.string().regex(dateRegex, 'Date must be YYYY-MM-DD'),
  start_time: z.string().regex(timeRegex, 'Start time must be HH:MM'),
  end_time: z.string().regex(timeRegex, 'End time must be HH:MM'),
  role: z.string().min(1, 'Role is required'),
  department: z.string().min(1, 'Department is required'),
});

export type CsvShiftRow = z.infer<typeof csvShiftRowSchema>;

// ---------------------------------------------------------------------------
// Callout schemas
// ---------------------------------------------------------------------------

export const calloutSchema = z.object({
  shift_id: z.string().uuid('Invalid shift ID'),
  reason: z.string().max(500, 'Reason is too long').optional(),
});

export type CalloutInput = z.infer<typeof calloutSchema>;

// ---------------------------------------------------------------------------
// Claim schemas
// ---------------------------------------------------------------------------

export const claimSchema = z.object({
  callout_id: z.string().uuid('Invalid callout ID'),
});

export type ClaimInput = z.infer<typeof claimSchema>;

export const claimApprovalSchema = z.object({
  claim_id: z.string().uuid('Invalid claim ID'),
  status: z.enum(['approved', 'rejected']),
});

export type ClaimApprovalInput = z.infer<typeof claimApprovalSchema>;
