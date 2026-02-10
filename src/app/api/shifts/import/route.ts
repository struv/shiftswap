import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

interface ShiftRow {
  date: string;
  start_time: string;
  end_time: string;
  role: string;
  department: string;
  employee_email: string;
}

interface ImportResult {
  row: number;
  status: 'created' | 'error';
  error?: string;
}

export async function POST(request: Request) {
  const supabase = await createClient();

  // Verify authentication
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Verify user is manager or admin
  const { data: profile } = (await supabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single()) as { data: { role: string } | null };

  if (!profile || profile.role === 'staff') {
    return NextResponse.json(
      { error: 'Only managers and admins can import shifts' },
      { status: 403 }
    );
  }

  let body: { shifts: ShiftRow[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (!Array.isArray(body.shifts) || body.shifts.length === 0) {
    return NextResponse.json(
      { error: 'Request must contain a non-empty shifts array' },
      { status: 400 }
    );
  }

  // Collect unique emails and look up user IDs
  const emails = [...new Set(body.shifts.map((s) => s.employee_email))];
  const { data: users } = (await supabase
    .from('users')
    .select('id, email')
    .in('email', emails)) as { data: { id: string; email: string }[] | null };

  const emailToId = new Map<string, string>();
  if (users) {
    for (const u of users) {
      emailToId.set(u.email, u.id);
    }
  }

  const results: ImportResult[] = [];
  let created = 0;

  for (let i = 0; i < body.shifts.length; i++) {
    const row = body.shifts[i];
    const rowNum = i + 1;

    // Look up user ID from email
    const userId = emailToId.get(row.employee_email);
    if (!userId) {
      results.push({
        row: rowNum,
        status: 'error',
        error: `Unknown employee email: ${row.employee_email}`,
      });
      continue;
    }

    // Validate date format
    if (!/^\d{4}-\d{2}-\d{2}$/.test(row.date)) {
      results.push({
        row: rowNum,
        status: 'error',
        error: `Invalid date format: ${row.date} (expected YYYY-MM-DD)`,
      });
      continue;
    }

    // Validate time formats
    if (!/^\d{2}:\d{2}$/.test(row.start_time)) {
      results.push({
        row: rowNum,
        status: 'error',
        error: `Invalid start_time format: ${row.start_time} (expected HH:MM)`,
      });
      continue;
    }

    if (!/^\d{2}:\d{2}$/.test(row.end_time)) {
      results.push({
        row: rowNum,
        status: 'error',
        error: `Invalid end_time format: ${row.end_time} (expected HH:MM)`,
      });
      continue;
    }

    if (!row.role) {
      results.push({ row: rowNum, status: 'error', error: 'Missing role' });
      continue;
    }

    if (!row.department) {
      results.push({
        row: rowNum,
        status: 'error',
        error: 'Missing department/location',
      });
      continue;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.from('shifts') as any).insert({
      user_id: userId,
      date: row.date,
      start_time: row.start_time,
      end_time: row.end_time,
      role: row.role,
      department: row.department,
    });

    if (error) {
      results.push({ row: rowNum, status: 'error', error: error.message });
    } else {
      results.push({ row: rowNum, status: 'created' });
      created++;
    }
  }

  return NextResponse.json({
    total: body.shifts.length,
    created,
    errors: results.filter((r) => r.status === 'error').length,
    results,
  });
}
