/**
 * Seed script for ShiftSwap — creates William's 23-location medical practice.
 *
 * Creates:
 * - 1 organization
 * - 23 locations (stored as department values on shifts)
 * - 24 users: 1 admin, 3 managers, 20 staff
 * - Sample shifts for the next 2 weeks
 *
 * Usage:
 *   npx tsx scripts/seed.ts
 *
 * Required env vars:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 */

import { createClient } from '@supabase/supabase-js';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error(
    'Error: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.'
  );
  console.error('Copy .env.example to .env.local and fill in the values.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ---------------------------------------------------------------------------
// Data definitions
// ---------------------------------------------------------------------------

const ORG_NAME = "William's Medical Practice";
const ORG_SLUG = 'williams-medical';

const LOCATIONS = [
  'Downtown Clinic',
  'West Side Medical',
  'East End Health Center',
  'North Point Urgent Care',
  'South Bay Family Medicine',
  'Riverside Medical Group',
  'Lakewood Health',
  'Hillcrest Medical',
  'Cedar Park Clinic',
  'Oakdale Health Center',
  'Pine Valley Medical',
  'Maple Ridge Clinic',
  'Springfield Medical',
  'Fairview Health',
  'Harbor View Clinic',
  'Summit Medical Center',
  'Valley Creek Health',
  'Brookfield Medical',
  'Greenwood Clinic',
  'Parkside Health Center',
  'Meadows Medical Group',
  'Crossroads Urgent Care',
  'Sunnyvale Family Med',
];

interface SeedUser {
  email: string;
  name: string;
  role: 'admin' | 'manager' | 'staff';
  password: string;
}

const USERS: SeedUser[] = [
  // Admin
  { email: 'william@williamsmed.com', name: 'William Harris', role: 'admin', password: 'seed-admin-2024!' },
  // Managers
  { email: 'sarah.m@williamsmed.com', name: 'Sarah Mitchell', role: 'manager', password: 'seed-manager-2024!' },
  { email: 'james.t@williamsmed.com', name: 'James Thompson', role: 'manager', password: 'seed-manager-2024!' },
  { email: 'lisa.c@williamsmed.com', name: 'Lisa Chen', role: 'manager', password: 'seed-manager-2024!' },
  // Staff (20)
  { email: 'emily.r@williamsmed.com', name: 'Emily Rodriguez', role: 'staff', password: 'seed-staff-2024!' },
  { email: 'michael.j@williamsmed.com', name: 'Michael Johnson', role: 'staff', password: 'seed-staff-2024!' },
  { email: 'jessica.w@williamsmed.com', name: 'Jessica Williams', role: 'staff', password: 'seed-staff-2024!' },
  { email: 'david.b@williamsmed.com', name: 'David Brown', role: 'staff', password: 'seed-staff-2024!' },
  { email: 'ashley.d@williamsmed.com', name: 'Ashley Davis', role: 'staff', password: 'seed-staff-2024!' },
  { email: 'chris.m@williamsmed.com', name: 'Christopher Martinez', role: 'staff', password: 'seed-staff-2024!' },
  { email: 'amanda.g@williamsmed.com', name: 'Amanda Garcia', role: 'staff', password: 'seed-staff-2024!' },
  { email: 'daniel.a@williamsmed.com', name: 'Daniel Anderson', role: 'staff', password: 'seed-staff-2024!' },
  { email: 'stephanie.t@williamsmed.com', name: 'Stephanie Taylor', role: 'staff', password: 'seed-staff-2024!' },
  { email: 'matthew.h@williamsmed.com', name: 'Matthew Hernandez', role: 'staff', password: 'seed-staff-2024!' },
  { email: 'nicole.m@williamsmed.com', name: 'Nicole Moore', role: 'staff', password: 'seed-staff-2024!' },
  { email: 'andrew.l@williamsmed.com', name: 'Andrew Lee', role: 'staff', password: 'seed-staff-2024!' },
  { email: 'rachel.w@williamsmed.com', name: 'Rachel Wilson', role: 'staff', password: 'seed-staff-2024!' },
  { email: 'kevin.k@williamsmed.com', name: 'Kevin Kim', role: 'staff', password: 'seed-staff-2024!' },
  { email: 'megan.p@williamsmed.com', name: 'Megan Patel', role: 'staff', password: 'seed-staff-2024!' },
  { email: 'brian.n@williamsmed.com', name: 'Brian Nguyen', role: 'staff', password: 'seed-staff-2024!' },
  { email: 'laura.s@williamsmed.com', name: 'Laura Scott', role: 'staff', password: 'seed-staff-2024!' },
  { email: 'jason.r@williamsmed.com', name: 'Jason Robinson', role: 'staff', password: 'seed-staff-2024!' },
  { email: 'heather.c@williamsmed.com', name: 'Heather Clark', role: 'staff', password: 'seed-staff-2024!' },
  { email: 'tyler.l@williamsmed.com', name: 'Tyler Lewis', role: 'staff', password: 'seed-staff-2024!' },
];

const ROLES = [
  'Medical Assistant',
  'Receptionist',
  'Nurse',
  'Lab Technician',
  'Phlebotomist',
];

const SHIFT_PATTERNS = [
  { start: '07:00', end: '15:00' }, // Morning
  { start: '08:00', end: '16:00' }, // Day
  { start: '09:00', end: '17:00' }, // Standard
  { start: '10:00', end: '18:00' }, // Late morning
  { start: '12:00', end: '20:00' }, // Afternoon
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addDays(date: Date, days: number): Date {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== ShiftSwap Seed Script ===\n');

  // 1. Create organization
  console.log(`Creating organization: ${ORG_NAME}`);
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .upsert(
      {
        name: ORG_NAME,
        slug: ORG_SLUG,
        settings: { locations: LOCATIONS },
        plan: 'pro',
        status: 'active',
      },
      { onConflict: 'slug' }
    )
    .select()
    .single();

  if (orgError) {
    console.error('Failed to create org:', orgError.message);
    process.exit(1);
  }
  console.log(`  Org ID: ${org.id}\n`);

  // 2. Create users via Supabase Auth admin API
  console.log('Creating users...');
  const userIds: Map<string, string> = new Map();

  for (const u of USERS) {
    // Create auth user (idempotent — we check if exists first)
    const { data: existingUsers } = await supabase.auth.admin.listUsers();
    const existing = existingUsers?.users.find(
      (eu) => eu.email === u.email
    );

    let userId: string;
    if (existing) {
      userId = existing.id;
      console.log(`  [exists] ${u.name} (${u.email})`);
    } else {
      const { data: authUser, error: authError } =
        await supabase.auth.admin.createUser({
          email: u.email,
          password: u.password,
          email_confirm: true,
          user_metadata: { name: u.name },
        });

      if (authError) {
        console.error(`  [error] ${u.email}: ${authError.message}`);
        continue;
      }
      userId = authUser.user.id;
      console.log(`  [created] ${u.name} (${u.email})`);
    }

    userIds.set(u.email, userId);

    // Update user role in public.users table
    await supabase
      .from('users')
      .update({ role: u.role, name: u.name })
      .eq('id', userId);

    // Add to org_members (upsert to avoid conflicts)
    await supabase.from('org_members').upsert(
      {
        org_id: org.id,
        user_id: userId,
        role: u.role,
      },
      { onConflict: 'org_id,user_id' }
    );
  }

  console.log(`  Total users: ${userIds.size}\n`);

  // 3. Create shifts for the next 2 weeks
  console.log('Creating shifts for next 2 weeks...');
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const staffUsers = USERS.filter((u) => u.role === 'staff');
  const shifts: Array<{
    user_id: string;
    date: string;
    start_time: string;
    end_time: string;
    role: string;
    department: string;
  }> = [];

  // For each day in the next 14 days
  for (let dayOffset = 0; dayOffset < 14; dayOffset++) {
    const date = addDays(today, dayOffset);
    const dayOfWeek = date.getDay();

    // Skip Sundays (most clinics closed)
    if (dayOfWeek === 0) continue;

    // Assign shifts to staff — each staff member works ~5 days/week
    for (const staffUser of staffUsers) {
      // ~70% chance they work on any given weekday
      if (Math.random() > 0.7) continue;

      const userId = userIds.get(staffUser.email);
      if (!userId) continue;

      const pattern = pick(SHIFT_PATTERNS);
      const role = pick(ROLES);
      const location = pick(LOCATIONS);

      shifts.push({
        user_id: userId,
        date: formatDate(date),
        start_time: pattern.start,
        end_time: pattern.end,
        role,
        department: location,
      });
    }
  }

  // Insert shifts in batches of 50
  let created = 0;
  for (let i = 0; i < shifts.length; i += 50) {
    const batch = shifts.slice(i, i + 50);
    const { error: shiftError } = await supabase.from('shifts').insert(batch);

    if (shiftError) {
      console.error(`  Batch error at ${i}: ${shiftError.message}`);
    } else {
      created += batch.length;
    }
  }

  console.log(`  Created ${created} shifts across ${LOCATIONS.length} locations\n`);

  // 4. Generate sample CSV for testing the import UI
  console.log('Generating sample CSV file...');
  const csvHeader = 'date,start_time,end_time,role,location,employee_email';
  const csvRows = shifts.slice(0, 20).map((s) => {
    const user = USERS.find(
      (u) => userIds.get(u.email) === s.user_id
    );
    return `${s.date},${s.start_time},${s.end_time},${s.role},${s.department},${user?.email || ''}`;
  });

  const csvContent = [csvHeader, ...csvRows].join('\n');
  const fs = await import('fs');
  fs.writeFileSync('scripts/sample-shifts.csv', csvContent, 'utf-8');
  console.log('  Written to scripts/sample-shifts.csv (20 rows)\n');

  // Summary
  console.log('=== Seed Complete ===');
  console.log(`  Organization: ${ORG_NAME} (${org.id})`);
  console.log(`  Users: ${userIds.size} (1 admin, 3 managers, ${staffUsers.length} staff)`);
  console.log(`  Locations: ${LOCATIONS.length}`);
  console.log(`  Shifts: ${created}`);
  console.log(`\n  Admin login: william@williamsmed.com / seed-admin-2024!`);
  console.log(`  Manager login: sarah.m@williamsmed.com / seed-manager-2024!`);
  console.log(`  Staff login: emily.r@williamsmed.com / seed-staff-2024!`);
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
