import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { z } from 'zod';

const bulkImportSchema = z.object({
  shifts: z.array(
    z.object({
      email: z.string().email(),
      date: z.string(),
      startTime: z.string(),
      endTime: z.string(),
      role: z.string(),
      department: z.string(),
    })
  ),
});

export async function POST(req: NextRequest) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = await createClient() as any;

  // Verify authenticated user
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Check org membership and role
  const { data: membership } = await supabase
    .from('org_members')
    .select('org_id, role')
    .eq('user_id', user.id)
    .single();

  if (!membership) {
    return NextResponse.json({ error: 'No organization found' }, { status: 403 });
  }

  if (membership.role === 'staff') {
    return NextResponse.json({ error: 'Only managers and admins can import shifts' }, { status: 403 });
  }

  // Set org context for RLS
  await supabase.rpc('set_org_context', { org_id: membership.org_id });

  // Parse and validate request body
  const body = await req.json();
  const parsed = bulkImportSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request body', details: parsed.error.issues }, { status: 400 });
  }

  const { shifts } = parsed.data;

  // Resolve emails to user IDs
  const emails = [...new Set(shifts.map((s) => s.email))];
  const { data: users, error: usersError } = await supabase
    .from('users')
    .select('id, email')
    .in('email', emails);

  if (usersError) {
    return NextResponse.json({ error: `Failed to look up users: ${usersError.message}` }, { status: 500 });
  }

  const emailToId = new Map<string, string>();
  for (const u of users ?? []) {
    emailToId.set(u.email, u.id);
  }

  const created: { row: number; shiftId: string }[] = [];
  const errors: { row: number; email: string; reason: string }[] = [];

  for (let i = 0; i < shifts.length; i++) {
    const s = shifts[i];
    const userId = emailToId.get(s.email);

    if (!userId) {
      errors.push({ row: i + 1, email: s.email, reason: `User not found: ${s.email}` });
      continue;
    }

    if (s.startTime >= s.endTime) {
      errors.push({ row: i + 1, email: s.email, reason: 'End time must be after start time' });
      continue;
    }

    // Check for overlapping shifts
    const { data: overlaps } = await supabase
      .from('shifts')
      .select('id')
      .eq('user_id', userId)
      .eq('date', s.date)
      .lt('start_time', s.endTime)
      .gt('end_time', s.startTime);

    if (overlaps && overlaps.length > 0) {
      errors.push({ row: i + 1, email: s.email, reason: 'Overlaps with an existing shift' });
      continue;
    }

    const { data: shift, error } = await supabase
      .from('shifts')
      .insert({
        user_id: userId,
        date: s.date,
        start_time: s.startTime,
        end_time: s.endTime,
        role: s.role,
        department: s.department,
      })
      .select('id')
      .single();

    if (error) {
      errors.push({ row: i + 1, email: s.email, reason: error.message });
    } else {
      created.push({ row: i + 1, shiftId: shift.id });
    }
  }

  return NextResponse.json({ created: created.length, errors, total: shifts.length });
}
