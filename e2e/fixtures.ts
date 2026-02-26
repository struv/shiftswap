import { test as base, expect } from '@playwright/test';

/**
 * E2E test fixtures for ShiftSwap
 * Provides authenticated page contexts for different user roles
 */

// Test user credentials (must exist in test database)
export const TEST_USERS = {
  staff1: {
    email: 'staff1@test.shiftswap.com',
    password: 'TestPassword123!',
    role: 'staff',
  },
  staff2: {
    email: 'staff2@test.shiftswap.com', 
    password: 'TestPassword123!',
    role: 'staff',
  },
  manager: {
    email: 'manager@test.shiftswap.com',
    password: 'TestPassword123!',
    role: 'manager',
  },
};

type TestUser = keyof typeof TEST_USERS;

// Extended test fixture with login helper
export const test = base.extend<{
  loginAs: (user: TestUser) => Promise<void>;
}>({
  loginAs: async ({ page }, use) => {
    const loginAs = async (user: TestUser) => {
      const { email, password } = TEST_USERS[user];
      
      await page.goto('/login');
      await page.fill('input[name="email"]', email);
      await page.fill('input[name="password"]', password);
      await page.click('button[type="submit"]');
      
      // Wait for redirect to dashboard
      await page.waitForURL(/\/(dashboard|callouts|claims)/);
    };
    
    await use(loginAs);
  },
});

export { expect };
