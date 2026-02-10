/**
 * Seed script for ShiftSwap
 *
 * Creates sample data for William's 23 medical clinic locations:
 * - 1 admin user
 * - 3 manager users
 * - 20 staff users
 * - Sample shifts for the next 2 weeks
 *
 * Requirements:
 *   SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables
 *
 * Usage:
 *   npm run seed
 */

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    'Missing environment variables.\n' +
    'Set SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SERVICE_ROLE_KEY.\n\n' +
    'Example:\n' +
    '  SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=yyy npm run seed'
  );
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── William's 23 clinic locations ──────────────────────────────────────────

const LOCATIONS = [
  'Downtown Medical Center',
  'Eastside Family Clinic',
  'Westview Health Hub',
  'Northgate Urgent Care',
  'Southpark Medical Group',
  'Lakewood Primary Care',
  'Riverside Wellness Center',
  'Hillcrest Medical Pavilion',
  'Cedar Grove Clinic',
  'Maple Street Practice',
  'Oakwood Health Services',
  'Pinecrest Medical Office',
  'Elmwood Family Medicine',
  'Birchwood Walk-In Clinic',
  'Willow Creek Health Center',
  'Aspen Ridge Medical',
  'Juniper Hills Clinic',
  'Magnolia Park Medical',
  'Sycamore Lane Practice',
  'Cypress Point Health',
  'Hawthorn Medical Group',
  'Laurel Heights Clinic',
  'Chestnut Valley Care',
];

// ── Roles ──────────────────────────────────────────────────────────────────

const STAFF_ROLES = [
  'Medical Assistant',
  'Front Desk',
  'Nurse Practitioner',
  'Registered Nurse',
  'Lab Technician',
  'Phlebotomist',
  'Radiology Tech',
  'Receptionist',
];

// ── Users to seed ──────────────────────────────────────────────────────────

interface SeedUser {
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'staff';
  password: string;
}

const ADMIN_USERS: SeedUser[] = [
  { email: 'admin@shiftswap.demo', name: 'William Chen', role: 'admin', password: 'demo-admin-2025!' },
];

const MANAGER_USERS: SeedUser[] = [
  { email: 'manager1@shiftswap.demo', name: 'Sarah Johnson', role: 'manager', password: 'demo-manager-2025!' },
  { email: 'manager2@shiftswap.demo', name: 'Marcus Williams', role: 'manager', password: 'demo-manager-2025!' },
  { email: 'manager3@shiftswap.demo', name: 'Linda Patel', role: 'manager', password: 'demo-manager-2025!' },
];

const STAFF_USERS: SeedUser[] = [
  { email: 'staff01@shiftswap.demo', name: 'Emily Davis', role: 'staff', password: 'demo-staff-2025!' },
  { email: 'staff02@shiftswap.demo', name: 'James Brown', role: 'staff', password: 'demo-staff-2025!' },
  { email: 'staff03@shiftswap.demo', name: 'Maria Garcia', role: 'staff', password: 'demo-staff-2025!' },
  { email: 'staff04@shiftswap.demo', name: 'David Kim', role: 'staff', password: 'demo-staff-2025!' },
  { email: 'staff05@shiftswap.demo', name: 'Ashley Miller', role: 'staff', password: 'demo-staff-2025!' },
  { email: 'staff06@shiftswap.demo', name: 'Robert Taylor', role: 'staff', password: 'demo-staff-2025!' },
  { email: 'staff07@shiftswap.demo', name: 'Jennifer Lee', role: 'staff', password: 'demo-staff-2025!' },
  { email: 'staff08@shiftswap.demo', name: 'Michael Nguyen', role: 'staff', password: 'demo-staff-2025!' },
  { email: 'staff09@shiftswap.demo', name: 'Jessica Martinez', role: 'staff', password: 'demo-staff-2025!' },
  { email: 'staff10@shiftswap.demo', name: 'Daniel Anderson', role: 'staff', password: 'demo-staff-2025!' },
  { email: 'staff11@shiftswap.demo', name: 'Amanda Thompson', role: 'staff', password: 'demo-staff-2025!' },
  { email: 'staff12@shiftswap.demo', name: 'Christopher White', role: 'staff', password: 'demo-staff-2025!' },
  { email: 'staff13@shiftswap.demo', name: 'Stephanie Harris', role: 'staff', password: 'demo-staff-2025!' },
  { email: 'staff14@shiftswap.demo', name: 'Kevin Clark', role: 'staff', password: 'demo-staff-2025!' },
  { email: 'staff15@shiftswap.demo', name: 'Nicole Lewis', role: 'staff', password: 'demo-staff-2025!' },
  { email: 'staff16@shiftswap.demo', name: 'Brian Robinson', role: 'staff', password: 'demo-staff-2025!' },
  { email: 'staff17@shiftswap.demo', name: 'Rachel Walker', role: 'staff', password: 'demo-staff-2025!' },
  { email: 'staff18@shiftswap.demo', name: 'Andrew Hall', role: 'staff', password: 'demo-staff-2025!' },
  { email: 'staff19@shiftswap.demo', name: 'Megan Young', role: 'staff', password: 'demo-staff-2025!' },
  { email: 'staff20@shiftswap.demo', name: 'Ryan King', role: 'staff', password: 'demo-staff-2025!' },
];

const ALL_USERS = [...ADMIN_USERS, ...MANAGER_USERS, ...STAFF_USERS];

// ── Shift templates (morning, afternoon, night) ────────────────────────────

const SHIFT_TEMPLATES = [
  { start: '07:00', end: '15:00' },
  { start: '08:00', end: '16:00' },
  { start: '09:00', end: '17:00' },
  { start: '15:00', end: '23:00' },
  { start: '16:00', end: '00:00' },
  { start: '23:00', end: '07:00' },
];

// ── Helpers ────────────────────────────────────────────────────────────────

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function pickRandom<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── Main seed function ─────────────────────────────────────────────────────

async function seed() {
  console.log('🌱 Starting ShiftSwap seed...\n');

  // 1. Create users via Supabase Auth admin API
  console.log('Creating users...');
  const userIdMap = new Map<string, string>(); // email -> id

  for (const user of ALL_USERS) {
    // Check if user already exists
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(u => u.email === user.email);

    if (existing) {
      console.log(`  ✓ ${user.name} (${user.email}) already exists`);
      userIdMap.set(user.email, existing.id);

      // Ensure profile has correct role
      await supabase
        .from('users')
        .upsert({
          id: existing.id,
          email: user.email,
          name: user.name,
          role: user.role,
        }, { onConflict: 'id' });

      continue;
    }

    const { data: authUser, error } = await supabase.auth.admin.createUser({
      email: user.email,
      password: user.password,
      email_confirm: true,
      user_metadata: { name: user.name },
    });

    if (error) {
      console.error(`  ✗ Failed to create ${user.name}: ${error.message}`);
      continue;
    }

    console.log(`  + ${user.name} (${user.email}) — ${user.role}`);
    userIdMap.set(user.email, authUser.user.id);

    // Update role in users table (trigger creates with 'staff' by default)
    if (user.role !== 'staff') {
      await supabase
        .from('users')
        .update({ role: user.role, name: user.name })
        .eq('id', authUser.user.id);
    }
  }

  console.log(`\n  Total users: ${userIdMap.size}\n`);

  // 2. Generate shifts for the next 2 weeks
  console.log('Creating shifts for next 2 weeks across 23 locations...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const shifts: Array<{
    user_id: string;
    date: string;
    start_time: string;
    end_time: string;
    role: string;
    department: string;
  }> = [];

  // Get all staff + manager user IDs (they all work shifts)
  const shiftWorkers = [...MANAGER_USERS, ...STAFF_USERS]
    .map(u => ({ email: u.email, id: userIdMap.get(u.email) }))
    .filter((u): u is { email: string; id: string } => !!u.id);

  // For each day in the next 14 days
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const date = new Date(today);
    date.setDate(date.getDate() + dayOffset);
    const dateStr = formatDate(date);

    // For each location, assign 2-4 shifts per day
    for (const location of LOCATIONS) {
      const shiftsPerDay = 2 + Math.floor(Math.random() * 3); // 2–4 shifts

      for (let s = 0; s < shiftsPerDay; s++) {
        const worker = pickRandom(shiftWorkers);
        const template = pickRandom(SHIFT_TEMPLATES);
        const role = pickRandom(STAFF_ROLES);

        shifts.push({
          user_id: worker.id,
          date: dateStr,
          start_time: template.start,
          end_time: template.end,
          role,
          department: location,
        });
      }
    }
  }

  // Batch insert shifts (Supabase handles up to 1000 at a time)
  const BATCH = 500;
  let insertedCount = 0;

  for (let i = 0; i < shifts.length; i += BATCH) {
    const batch = shifts.slice(i, i + BATCH);
    const { error } = await supabase.from('shifts').insert(batch);

    if (error) {
      console.error(`  ✗ Batch ${Math.floor(i / BATCH) + 1} failed: ${error.message}`);
    } else {
      insertedCount += batch.length;
    }
  }

  console.log(`  + ${insertedCount} shifts created`);
  console.log(`  Across ${LOCATIONS.length} locations, 14 days\n`);

  // 3. Summary
  console.log('═══════════════════════════════════════════');
  console.log('  Seed complete!');
  console.log('═══════════════════════════════════════════');
  console.log(`  Admin users:   ${ADMIN_USERS.length}`);
  console.log(`  Manager users: ${MANAGER_USERS.length}`);
  console.log(`  Staff users:   ${STAFF_USERS.length}`);
  console.log(`  Locations:     ${LOCATIONS.length}`);
  console.log(`  Shifts:        ${insertedCount}`);
  console.log('');
  console.log('  Login credentials:');
  console.log('  Admin:   admin@shiftswap.demo / demo-admin-2025!');
  console.log('  Manager: manager1@shiftswap.demo / demo-manager-2025!');
  console.log('  Staff:   staff01@shiftswap.demo / demo-staff-2025!');
  console.log('═══════════════════════════════════════════\n');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
