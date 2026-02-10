/**
 * Seed script for William's Pediatric Medical Group.
 *
 * Creates:
 *  - 1 organization
 *  - 24 users (1 admin, 3 managers, 20 staff) with auth accounts
 *  - Org memberships for all users
 *  - Sample shifts across 23 locations for the next 2 weeks
 *
 * Requirements:
 *  - SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars
 *  - Run: npm run seed
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Missing environment variables. Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------- William's 23 locations ----------
const LOCATIONS = [
  'Downtown Clinic',
  'Westside Pediatrics',
  'Eastside Family Care',
  'North Valley Office',
  'South Bay Clinic',
  'Lakewood Center',
  'Riverside Health',
  'Maple Street Clinic',
  'Oak Park Office',
  'Cedar Heights Pediatrics',
  'Pinecrest Medical',
  'Willow Creek Clinic',
  'Sunrise Health Center',
  'Sunset Pediatrics',
  'Harbor View Clinic',
  'Mountain View Office',
  'Valley Medical Center',
  'Brookside Clinic',
  'Greenfield Pediatrics',
  'Fairview Health',
  'Springfield Office',
  'Meadowbrook Clinic',
  'Hillcrest Pediatrics',
];

// ---------- Sample users ----------
const USERS = [
  // Admin
  { name: 'William Chen', email: 'william@pediatricmedgroup.com', role: 'admin', department: 'Administration' },
  // Managers
  { name: 'Sarah Johnson', email: 'sarah.j@pediatricmedgroup.com', role: 'manager', department: 'Operations' },
  { name: 'Michael Rodriguez', email: 'michael.r@pediatricmedgroup.com', role: 'manager', department: 'Operations' },
  { name: 'Emily Nguyen', email: 'emily.n@pediatricmedgroup.com', role: 'manager', department: 'Operations' },
  // Staff (20)
  { name: 'Dr. Lisa Park', email: 'lisa.p@pediatricmedgroup.com', role: 'staff', department: 'Pediatrics' },
  { name: 'Dr. James Wilson', email: 'james.w@pediatricmedgroup.com', role: 'staff', department: 'Pediatrics' },
  { name: 'Dr. Ana Martinez', email: 'ana.m@pediatricmedgroup.com', role: 'staff', department: 'Pediatrics' },
  { name: 'Dr. David Kim', email: 'david.k@pediatricmedgroup.com', role: 'staff', department: 'Pediatrics' },
  { name: 'Dr. Rachel Green', email: 'rachel.g@pediatricmedgroup.com', role: 'staff', department: 'Pediatrics' },
  { name: 'Nurse Amy Thompson', email: 'amy.t@pediatricmedgroup.com', role: 'staff', department: 'Nursing' },
  { name: 'Nurse Brian Lee', email: 'brian.l@pediatricmedgroup.com', role: 'staff', department: 'Nursing' },
  { name: 'Nurse Carol Davis', email: 'carol.d@pediatricmedgroup.com', role: 'staff', department: 'Nursing' },
  { name: 'Nurse Derek Foster', email: 'derek.f@pediatricmedgroup.com', role: 'staff', department: 'Nursing' },
  { name: 'Nurse Eva Santos', email: 'eva.s@pediatricmedgroup.com', role: 'staff', department: 'Nursing' },
  { name: 'Tech Fiona Chang', email: 'fiona.c@pediatricmedgroup.com', role: 'staff', department: 'Lab Tech' },
  { name: 'Tech George Hill', email: 'george.h@pediatricmedgroup.com', role: 'staff', department: 'Lab Tech' },
  { name: 'Admin Helen Morris', email: 'helen.m@pediatricmedgroup.com', role: 'staff', department: 'Front Desk' },
  { name: 'Admin Ivan Petrov', email: 'ivan.p@pediatricmedgroup.com', role: 'staff', department: 'Front Desk' },
  { name: 'Admin Julia Clark', email: 'julia.c@pediatricmedgroup.com', role: 'staff', department: 'Front Desk' },
  { name: 'Admin Karen White', email: 'karen.w@pediatricmedgroup.com', role: 'staff', department: 'Front Desk' },
  { name: 'MA Laura Bennett', email: 'laura.b@pediatricmedgroup.com', role: 'staff', department: 'Medical Assistant' },
  { name: 'MA Nathan Cooper', email: 'nathan.c@pediatricmedgroup.com', role: 'staff', department: 'Medical Assistant' },
  { name: 'MA Olivia Reed', email: 'olivia.r@pediatricmedgroup.com', role: 'staff', department: 'Medical Assistant' },
  { name: 'MA Peter Young', email: 'peter.y@pediatricmedgroup.com', role: 'staff', department: 'Medical Assistant' },
];

const DEFAULT_PASSWORD = 'ShiftSwap2026!';

// Shift templates: role → typical shifts
const SHIFT_TEMPLATES = [
  { startTime: '07:00', endTime: '15:00', label: 'Morning' },
  { startTime: '08:00', endTime: '16:00', label: 'Day' },
  { startTime: '09:00', endTime: '17:00', label: 'Standard' },
  { startTime: '10:00', endTime: '18:00', label: 'Late Morning' },
  { startTime: '12:00', endTime: '20:00', label: 'Afternoon' },
];

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

async function seed() {
  console.log('Starting seed...\n');

  // 1. Create organization
  console.log('Creating organization...');
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .insert({
      name: "William's Pediatric Medical Group",
      slug: 'williams-pediatric-medical-group',
      settings: { locations: LOCATIONS },
      plan: 'pro',
      status: 'active',
    })
    .select()
    .single();

  if (orgError) {
    // Check if org already exists
    if (orgError.code === '23505') {
      console.log('Organization already exists, fetching...');
      const { data: existingOrg } = await supabase
        .from('organizations')
        .select()
        .eq('slug', 'williams-pediatric-medical-group')
        .single();
      if (!existingOrg) {
        console.error('Failed to find existing org');
        process.exit(1);
      }
      console.log(`  Using existing org: ${existingOrg.id}`);
      await seedUsersAndShifts(existingOrg.id);
      return;
    }
    console.error('Failed to create org:', orgError);
    process.exit(1);
  }

  console.log(`  Created org: ${org.id} (${org.name})\n`);
  await seedUsersAndShifts(org.id);
}

async function seedUsersAndShifts(orgId: string) {
  // 2. Create users via Supabase Auth Admin API
  console.log('Creating users...');
  const userIds: { id: string; email: string; role: string; department: string }[] = [];

  for (const user of USERS) {
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: user.email,
      password: DEFAULT_PASSWORD,
      email_confirm: true,
      user_metadata: { name: user.name },
    });

    if (authError) {
      if (authError.message.includes('already been registered') || authError.message.includes('already exists')) {
        // User exists, look them up
        const { data: { users } } = await supabase.auth.admin.listUsers();
        const existing = users?.find((u) => u.email === user.email);
        if (existing) {
          console.log(`  Existing: ${user.name} (${user.email})`);
          userIds.push({ id: existing.id, email: user.email, role: user.role, department: user.department });

          // Ensure profile exists
          await supabase.from('users').upsert({
            id: existing.id,
            email: user.email,
            name: user.name,
            role: user.role,
            department: user.department,
          });

          continue;
        }
      }
      console.error(`  Failed to create ${user.email}:`, authError.message);
      continue;
    }

    console.log(`  Created: ${user.name} (${user.email}) [${user.role}]`);
    userIds.push({ id: authData.user.id, email: user.email, role: user.role, department: user.department });

    // Update the user profile with role and department
    await supabase.from('users').upsert({
      id: authData.user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      department: user.department,
    });
  }

  console.log(`\n  Total users: ${userIds.length}\n`);

  // 3. Create org memberships
  console.log('Creating org memberships...');
  for (const user of userIds) {
    const orgRole = user.role === 'admin' ? 'admin' : user.role === 'manager' ? 'manager' : 'staff';
    const { error } = await supabase.from('org_members').upsert(
      { org_id: orgId, user_id: user.id, role: orgRole },
      { onConflict: 'org_id,user_id' }
    );
    if (error) {
      console.error(`  Failed membership for ${user.email}:`, error.message);
    }
  }
  console.log(`  Created ${userIds.length} memberships\n`);

  // 4. Create sample shifts for next 2 weeks
  console.log('Creating sample shifts for next 2 weeks...');
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  // Start from next Monday
  const dayOfWeek = today.getDay();
  const startDate = addDays(today, dayOfWeek === 0 ? 1 : 8 - dayOfWeek);

  const staffUsers = userIds.filter((u) => u.role === 'staff');
  let shiftCount = 0;
  const shiftsToInsert: {
    user_id: string;
    date: string;
    start_time: string;
    end_time: string;
    role: string;
    department: string;
  }[] = [];

  for (let day = 0; day < 14; day++) {
    const date = addDays(startDate, day);
    const dateStr = formatDate(date);
    const dayNum = date.getDay();

    // Skip weekends (only some staff work weekends)
    const isWeekend = dayNum === 0 || dayNum === 6;

    for (let i = 0; i < staffUsers.length; i++) {
      const user = staffUsers[i];

      // On weekends, only some staff work
      if (isWeekend && i % 3 !== 0) continue;

      // Assign a shift template based on user index and day
      const template = SHIFT_TEMPLATES[(i + day) % SHIFT_TEMPLATES.length];

      // Assign to a location (rotate through locations)
      const location = LOCATIONS[(i + day) % LOCATIONS.length];

      shiftsToInsert.push({
        user_id: user.id,
        date: dateStr,
        start_time: template.startTime,
        end_time: template.endTime,
        role: user.department,
        department: location,
      });
      shiftCount++;
    }
  }

  // Insert in batches of 50
  for (let i = 0; i < shiftsToInsert.length; i += 50) {
    const batch = shiftsToInsert.slice(i, i + 50);
    const { error } = await supabase.from('shifts').insert(batch);
    if (error) {
      console.error(`  Batch insert error at offset ${i}:`, error.message);
    } else {
      console.log(`  Inserted batch ${Math.floor(i / 50) + 1} (${batch.length} shifts)`);
    }
  }

  console.log(`\n  Total shifts created: ${shiftCount}`);

  // 5. Generate a sample CSV file for testing import
  console.log('\nGenerating sample CSV file...');
  const csvRows = ['email,date,start_time,end_time,role,department'];
  const sampleDate = formatDate(addDays(startDate, 15)); // Day after the 2-week period

  for (const user of staffUsers.slice(0, 10)) {
    const template = SHIFT_TEMPLATES[Math.floor(Math.random() * SHIFT_TEMPLATES.length)];
    const location = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
    csvRows.push(
      `${user.email},${sampleDate},${template.startTime},${template.endTime},${user.department},${location}`
    );
  }

  const csvContent = csvRows.join('\n');
  const fs = await import('fs');
  fs.writeFileSync('scripts/sample-shifts.csv', csvContent);
  console.log('  Saved to scripts/sample-shifts.csv\n');

  console.log('Seed complete!');
  console.log(`\n  Organization: William's Pediatric Medical Group`);
  console.log(`  Users: ${userIds.length} (1 admin, 3 managers, ${staffUsers.length} staff)`);
  console.log(`  Locations: ${LOCATIONS.length}`);
  console.log(`  Shifts: ${shiftCount}`);
  console.log(`\n  Login as admin: william@pediatricmedgroup.com / ${DEFAULT_PASSWORD}`);
  console.log(`  Login as manager: sarah.j@pediatricmedgroup.com / ${DEFAULT_PASSWORD}`);
  console.log(`  Login as staff: lisa.p@pediatricmedgroup.com / ${DEFAULT_PASSWORD}`);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
