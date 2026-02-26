/**
 * Seed script for E2E test users
 * Creates staff1, staff2, and manager accounts for testing
 * 
 * Run: npx tsx scripts/seed-test-users.ts
 */

import { createClient } from '@supabase/supabase-js';
import bcrypt from 'bcryptjs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

const TEST_USERS = [
  {
    email: 'staff1@test.shiftswap.com',
    password: 'TestPassword123!',
    name: 'Test Staff One',
    role: 'staff',
  },
  {
    email: 'staff2@test.shiftswap.com',
    password: 'TestPassword123!',
    name: 'Test Staff Two',
    role: 'staff',
  },
  {
    email: 'manager@test.shiftswap.com',
    password: 'TestPassword123!',
    name: 'Test Manager',
    role: 'manager',
  },
];

async function seedTestUsers() {
  console.log('🌱 Seeding test users...\n');

  for (const user of TEST_USERS) {
    try {
      // Create auth user
      const { data: authUser, error: authError } = await supabase.auth.admin.createUser({
        email: user.email,
        password: user.password,
        email_confirm: true,
      });

      if (authError) {
        if (authError.message.includes('already exists')) {
          console.log(`⏭️  ${user.email} already exists, skipping...`);
          continue;
        }
        throw authError;
      }

      // Create profile/user record
      const hashedPassword = await bcrypt.hash(user.password, 10);
      
      const { error: profileError } = await supabase
        .from('users')
        .upsert({
          id: authUser.user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          password_hash: hashedPassword,
        });

      if (profileError) {
        console.error(`❌ Failed to create profile for ${user.email}:`, profileError);
        continue;
      }

      console.log(`✅ Created ${user.role}: ${user.email}`);
    } catch (error) {
      console.error(`❌ Error creating ${user.email}:`, error);
    }
  }

  console.log('\n🎉 Test users seeded!');
  console.log('\nCredentials for E2E tests:');
  TEST_USERS.forEach(u => {
    console.log(`  ${u.role}: ${u.email} / ${u.password}`);
  });
}

seedTestUsers();
