import { z } from 'zod';

export const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const signupSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long'),
  email: z.string().email('Please enter a valid email address'),
  password: z
    .string()
    .min(6, 'Password must be at least 6 characters')
    .max(72, 'Password is too long'),
});

export const calloutSchema = z.object({
  shift_id: z.string().uuid('Invalid shift ID'),
  reason: z.string().max(500, 'Reason is too long').optional(),
});

export const claimSchema = z.object({
  callout_id: z.string().uuid('Invalid callout ID'),
});

export const profileUpdateSchema = z.object({
  name: z.string().min(1, 'Name is required').max(100, 'Name is too long').optional(),
  phone: z
    .string()
    .regex(/^\+?[\d\s-()]{7,20}$/, 'Please enter a valid phone number')
    .optional()
    .nullable(),
  department: z.string().max(100, 'Department name is too long').optional().nullable(),
});

export const shiftSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Date must be YYYY-MM-DD format'),
  start_time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM format'),
  end_time: z.string().regex(/^\d{2}:\d{2}$/, 'Time must be HH:MM format'),
  role: z.string().min(1, 'Role is required'),
  department: z.string().min(1, 'Department is required'),
});

export type LoginInput = z.infer<typeof loginSchema>;
export type SignupInput = z.infer<typeof signupSchema>;
export type CalloutInput = z.infer<typeof calloutSchema>;
export type ClaimInput = z.infer<typeof claimSchema>;
export type ProfileUpdateInput = z.infer<typeof profileUpdateSchema>;
export type ShiftInput = z.infer<typeof shiftSchema>;
