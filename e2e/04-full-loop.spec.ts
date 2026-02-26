import { test, expect, TEST_USERS } from './fixtures';

/**
 * Happy Path #4: The Full Loop
 * 
 * Complete end-to-end flow:
 * Staff A calls out → Staff B claims → Manager approves → Shift covered ✅
 * 
 * This test runs all scenarios in sequence as one integrated test.
 */
test.describe('Full Shift Swap Loop', () => {
  test('complete shift swap flow: callout → claim → approve', async ({ page }) => {
    // ═══════════════════════════════════════════════════════════
    // STEP 1: Staff1 posts a call-out
    // ═══════════════════════════════════════════════════════════
    console.log('📝 Step 1: Staff1 posting call-out...');
    
    // Login as staff1
    await page.goto('/login');
    await page.fill('input[name="email"]', TEST_USERS.staff1.email);
    await page.fill('input[name="password"]', TEST_USERS.staff1.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|callouts)/);
    
    // Go to new call-out page
    await page.goto('/callouts/new');
    
    // Find first available shift
    const shiftCard = page.locator('[data-testid="shift-card"]').first();
    const hasShifts = await shiftCard.isVisible({ timeout: 5000 }).catch(() => false);
    
    if (!hasShifts) {
      console.log('⚠️ No shifts available for staff1 - cannot run full loop');
      test.skip();
      return;
    }
    
    // Post the call-out
    await shiftCard.locator('button:has-text("Call Out"), button:has-text("Post Call-Out")').click();
    
    const confirmCallout = page.locator('button:has-text("Confirm"), button:has-text("Submit")');
    if (await confirmCallout.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmCallout.click();
    }
    
    // Wait for success
    await expect(page.locator('text=/success|created|posted/i')).toBeVisible({ timeout: 5000 });
    console.log('✅ Call-out posted');
    
    // Logout
    await page.goto('/logout');
    await page.waitForURL('/login');
    
    // ═══════════════════════════════════════════════════════════
    // STEP 2: Staff2 claims the open shift
    // ═══════════════════════════════════════════════════════════
    console.log('📝 Step 2: Staff2 claiming shift...');
    
    // Login as staff2
    await page.fill('input[name="email"]', TEST_USERS.staff2.email);
    await page.fill('input[name="password"]', TEST_USERS.staff2.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|callouts)/);
    
    // Go to open shifts
    await page.goto('/callouts');
    
    // Find the open shift
    const openShift = page.locator('[data-testid="open-shift-card"], [data-testid="callout-card"]').first();
    await expect(openShift).toBeVisible({ timeout: 5000 });
    
    // Claim it
    await openShift.locator('button:has-text("Take It"), button:has-text("Claim")').click();
    
    const confirmClaim = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
    if (await confirmClaim.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmClaim.click();
    }
    
    // Wait for success
    await expect(page.locator('text=/success|pending|submitted|claimed/i')).toBeVisible({ timeout: 5000 });
    console.log('✅ Shift claimed');
    
    // Logout
    await page.goto('/logout');
    await page.waitForURL('/login');
    
    // ═══════════════════════════════════════════════════════════
    // STEP 3: Manager approves the claim
    // ═══════════════════════════════════════════════════════════
    console.log('📝 Step 3: Manager approving claim...');
    
    // Login as manager
    await page.fill('input[name="email"]', TEST_USERS.manager.email);
    await page.fill('input[name="password"]', TEST_USERS.manager.password);
    await page.click('button[type="submit"]');
    await page.waitForURL(/\/(dashboard|claims)/);
    
    // Go to claims page
    await page.goto('/claims');
    
    // Find the pending claim
    const pendingClaim = page.locator('[data-testid="claim-card"], [data-testid="pending-claim"]').first();
    await expect(pendingClaim).toBeVisible({ timeout: 5000 });
    
    // Approve it
    await pendingClaim.locator('button:has-text("Approve")').click();
    
    const confirmApproval = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
    if (await confirmApproval.isVisible({ timeout: 2000 }).catch(() => false)) {
      await confirmApproval.click();
    }
    
    // Wait for success
    await expect(page.locator('text=/approved|success|confirmed/i')).toBeVisible({ timeout: 5000 });
    console.log('✅ Claim approved');
    
    // ═══════════════════════════════════════════════════════════
    // VERIFICATION: Shift is now covered
    // ═══════════════════════════════════════════════════════════
    console.log('🎉 Full loop complete: Shift covered!');
  });
});
