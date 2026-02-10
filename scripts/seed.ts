/**
 * Seed script for ShiftSwap demo data.
 *
 * Creates:
 * - 1 organization ("William's Medical Group")
 * - 23 clinic locations
 * - 24 users (1 admin, 3 managers, 20 staff)
 * - Org memberships and user-location assignments
 * - Sample shifts for the next 2 weeks
 *
 * Usage: npx tsx scripts/seed.ts
 * (or: npm run seed)
 *
 * Requires DATABASE_URL environment variable.
 */

import { Pool } from '@neondatabase/serverless';
import { randomUUID } from 'crypto';

const DATABASE_URL = process.env.DATABASE_URL;
if (!DATABASE_URL) {
  console.error('DATABASE_URL environment variable is required');
  process.exit(1);
}

const pool = new Pool({ connectionString: DATABASE_URL });

// ---------------------------------------------------------------------------
// Data definitions
// ---------------------------------------------------------------------------

const ORG_NAME = "William's Medical Group";
const ORG_SLUG = 'williams-medical';

const LOCATIONS = [
  'Downtown Clinic',
  'Westside Family Practice',
  'Eastside Medical Center',
  'North Valley Urgent Care',
  'South Bay Health Center',
  'Riverside Clinic',
  'Lakewood Medical Office',
  'Highland Park Practice',
  'Sunset Boulevard Clinic',
  'Harbor View Medical',
  'Mountain View Health',
  'Cedar Grove Clinic',
  'Oakdale Family Medicine',
  'Pinecrest Medical Center',
  'Maple Street Clinic',
  'Elm Avenue Practice',
  'Birchwood Health Center',
  'Willow Creek Clinic',
  'Aspen Ridge Medical',
  'Juniper Hills Clinic',
  'Magnolia Park Practice',
  'Sycamore Lane Medical',
  'Cypress Point Clinic',
];

const ROLES = ['Nurse', 'Medical Assistant', 'Receptionist', 'Lab Tech', 'Phlebotomist'];
const DEPARTMENTS = ['Primary Care', 'Urgent Care', 'Pediatrics', 'Internal Medicine', 'Family Medicine'];

interface SeedUser {
  name: string;
  email: string;
  role: 'admin' | 'manager' | 'staff';
  department: string;
  shiftRole: string;
}

const USERS: SeedUser[] = [
  // 1 Admin
  { name: 'William Chen', email: 'william@williams-medical.com', role: 'admin', department: 'Primary Care', shiftRole: 'Nurse' },

  // 3 Managers
  { name: 'Sarah Johnson', email: 'sarah.johnson@williams-medical.com', role: 'manager', department: 'Primary Care', shiftRole: 'Nurse' },
  { name: 'Michael Torres', email: 'michael.torres@williams-medical.com', role: 'manager', department: 'Urgent Care', shiftRole: 'Nurse' },
  { name: 'Jennifer Kim', email: 'jennifer.kim@williams-medical.com', role: 'manager', department: 'Pediatrics', shiftRole: 'Nurse' },

  // 20 Staff
  { name: 'Emily Davis', email: 'emily.davis@williams-medical.com', role: 'staff', department: 'Primary Care', shiftRole: 'Nurse' },
  { name: 'James Wilson', email: 'james.wilson@williams-medical.com', role: 'staff', department: 'Primary Care', shiftRole: 'Medical Assistant' },
  { name: 'Maria Garcia', email: 'maria.garcia@williams-medical.com', role: 'staff', department: 'Primary Care', shiftRole: 'Receptionist' },
  { name: 'David Martinez', email: 'david.martinez@williams-medical.com', role: 'staff', department: 'Urgent Care', shiftRole: 'Nurse' },
  { name: 'Ashley Brown', email: 'ashley.brown@williams-medical.com', role: 'staff', department: 'Urgent Care', shiftRole: 'Medical Assistant' },
  { name: 'Christopher Lee', email: 'chris.lee@williams-medical.com', role: 'staff', department: 'Urgent Care', shiftRole: 'Lab Tech' },
  { name: 'Jessica Taylor', email: 'jessica.taylor@williams-medical.com', role: 'staff', department: 'Pediatrics', shiftRole: 'Nurse' },
  { name: 'Daniel Anderson', email: 'daniel.anderson@williams-medical.com', role: 'staff', department: 'Pediatrics', shiftRole: 'Medical Assistant' },
  { name: 'Amanda Thomas', email: 'amanda.thomas@williams-medical.com', role: 'staff', department: 'Pediatrics', shiftRole: 'Receptionist' },
  { name: 'Ryan Jackson', email: 'ryan.jackson@williams-medical.com', role: 'staff', department: 'Internal Medicine', shiftRole: 'Nurse' },
  { name: 'Lauren White', email: 'lauren.white@williams-medical.com', role: 'staff', department: 'Internal Medicine', shiftRole: 'Medical Assistant' },
  { name: 'Kevin Harris', email: 'kevin.harris@williams-medical.com', role: 'staff', department: 'Internal Medicine', shiftRole: 'Phlebotomist' },
  { name: 'Stephanie Clark', email: 'stephanie.clark@williams-medical.com', role: 'staff', department: 'Family Medicine', shiftRole: 'Nurse' },
  { name: 'Brandon Lewis', email: 'brandon.lewis@williams-medical.com', role: 'staff', department: 'Family Medicine', shiftRole: 'Medical Assistant' },
  { name: 'Rachel Robinson', email: 'rachel.robinson@williams-medical.com', role: 'staff', department: 'Family Medicine', shiftRole: 'Receptionist' },
  { name: 'Tyler Walker', email: 'tyler.walker@williams-medical.com', role: 'staff', department: 'Primary Care', shiftRole: 'Lab Tech' },
  { name: 'Megan Hall', email: 'megan.hall@williams-medical.com', role: 'staff', department: 'Urgent Care', shiftRole: 'Nurse' },
  { name: 'Austin Young', email: 'austin.young@williams-medical.com', role: 'staff', department: 'Pediatrics', shiftRole: 'Phlebotomist' },
  { name: 'Kayla Allen', email: 'kayla.allen@williams-medical.com', role: 'staff', department: 'Internal Medicine', shiftRole: 'Receptionist' },
];

// Shift templates: common shift patterns
const SHIFT_TEMPLATES = [
  { start: '07:00', end: '15:00' }, // Morning
  { start: '08:00', end: '16:00' }, // Day
  { start: '09:00', end: '17:00' }, // Standard
  { start: '10:00', end: '18:00' }, // Late morning
  { start: '12:00', end: '20:00' }, // Afternoon
  { start: '14:00', end: '22:00' }, // Evening
];

// ---------------------------------------------------------------------------
// Helper functions
// ---------------------------------------------------------------------------

function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

function getNextNDays(n: number): string[] {
  const dates: string[] = [];
  const today = new Date();
  for (let i = 1; i <= n; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    // Skip Sundays (0)
    if (d.getDay() !== 0) {
      dates.push(formatDate(d));
    }
  }
  return dates;
}

// ---------------------------------------------------------------------------
// Main seed function
// ---------------------------------------------------------------------------

async function seed() {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    console.log('Seeding ShiftSwap database...\n');

    // 1. Create organization
    const orgId = randomUUID();
    await client.query(
      `INSERT INTO organizations (id, name, slug, plan, status)
       VALUES ($1, $2, $3, 'pro', 'active')
       ON CONFLICT (slug) DO UPDATE SET name = EXCLUDED.name
       RETURNING id`,
      [orgId, ORG_NAME, ORG_SLUG]
    );
    console.log(`Created org: ${ORG_NAME} (${orgId})`);

    // 2. Create locations
    const locationIds: string[] = [];
    for (const loc of LOCATIONS) {
      const locId = randomUUID();
      locationIds.push(locId);
      await client.query(
        `INSERT INTO locations (id, org_id, name, timezone)
         VALUES ($1, $2, $3, 'America/Los_Angeles')`,
        [locId, orgId, loc]
      );
    }
    console.log(`Created ${LOCATIONS.length} locations`);

    // 3. Create users + org_members + user_locations
    const userIds: string[] = [];
    for (let i = 0; i < USERS.length; i++) {
      const user = USERS[i];
      const userId = randomUUID();
      userIds.push(userId);

      // Create user
      await client.query(
        `INSERT INTO users (id, org_id, email, name, role, department)
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [userId, orgId, user.email, user.name, user.role, user.department]
      );

      // Create org membership
      await client.query(
        `INSERT INTO org_members (org_id, user_id, role)
         VALUES ($1, $2, $3)`,
        [orgId, userId, user.role]
      );

      // Assign to 1-3 locations
      const numLocations = Math.min(1 + (i % 3), locationIds.length);
      for (let j = 0; j < numLocations; j++) {
        const locIdx = (i * 3 + j) % locationIds.length;
        await client.query(
          `INSERT INTO user_locations (org_id, user_id, location_id, is_primary)
           VALUES ($1, $2, $3, $4)`,
          [orgId, userId, locationIds[locIdx], j === 0]
        );
      }
    }
    console.log(`Created ${USERS.length} users (1 admin, 3 managers, 20 staff)`);

    // 4. Create shifts for next 2 weeks
    const workDays = getNextNDays(14);
    let shiftCount = 0;

    for (const date of workDays) {
      // Each staff/manager gets a shift on most work days (80% chance)
      for (let i = 0; i < USERS.length; i++) {
        if (Math.random() > 0.8) continue; // Skip ~20% to make it realistic

        const user = USERS[i];
        const template = SHIFT_TEMPLATES[i % SHIFT_TEMPLATES.length];
        const locIdx = (i * 3) % locationIds.length;

        await client.query(
          `INSERT INTO shifts (org_id, user_id, location_id, date, start_time, end_time, role, department)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [orgId, userIds[i], locationIds[locIdx], date, template.start, template.end, user.shiftRole, user.department]
        );
        shiftCount++;
      }
    }
    console.log(`Created ${shiftCount} shifts across ${workDays.length} work days`);

    await client.query('COMMIT');

    console.log('\nSeed completed successfully!');
    console.log(`\nSummary:`);
    console.log(`  Organization: ${ORG_NAME}`);
    console.log(`  Locations: ${LOCATIONS.length}`);
    console.log(`  Users: ${USERS.length}`);
    console.log(`  Shifts: ${shiftCount}`);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('Seed failed, rolled back:', err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seed();
