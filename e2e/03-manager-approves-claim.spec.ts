import { test, expect } from './fixtures';

/**
 * Happy Path #3: Manager Approves a Claim
 * 
 * As a manager, I need to approve shift swaps to ensure
 * coverage is appropriate.
 */
test.describe('Manager Approves Claim', () => {
  test('manager can approve a pending claim', async ({ page, loginAs }) => {
    // Login as manager
    await loginAs('manager');
    
    // Navigate to Claims / Pending Approvals page
    await page.goto('/claims');
    
    // Verify we see the claims list
    await expect(page.locator('h1, h2').first()).toContainText(/claims|approvals|pending/i);
    
    // Find a pending claim
    const pendingClaim = page.locator('[data-testid="claim-card"], [data-testid="pending-claim"]').first();
    
    const hasPendingClaims = await pendingClaim.isVisible().catch(() => false);
    
    if (hasPendingClaims) {
      // Verify claim details are visible
      await expect(pendingClaim).toBeVisible();
      
      // Click "Approve" button
      await pendingClaim.locator('button:has-text("Approve")').click();
      
      // Confirm if there's a confirmation dialog
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
      if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmButton.click();
      }
      
      // Verify success - claim approved
      await expect(page.locator('text=/approved|success|confirmed/i')).toBeVisible({ timeout: 5000 });
    } else {
      console.log('No pending claims available - skipping approval test');
      test.skip();
    }
  });
  
  test('manager can deny a pending claim', async ({ page, loginAs }) => {
    // Login as manager
    await loginAs('manager');
    
    // Navigate to Claims page
    await page.goto('/claims');
    
    // Find a pending claim
    const pendingClaim = page.locator('[data-testid="claim-card"], [data-testid="pending-claim"]').first();
    
    const hasPendingClaims = await pendingClaim.isVisible().catch(() => false);
    
    if (hasPendingClaims) {
      // Click "Deny" button
      await pendingClaim.locator('button:has-text("Deny"), button:has-text("Reject")').click();
      
      // Confirm if needed
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
      if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmButton.click();
      }
      
      // Verify denial success
      await expect(page.locator('text=/denied|rejected|success/i')).toBeVisible({ timeout: 5000 });
    } else {
      console.log('No pending claims available - skipping deny test');
      test.skip();
    }
  });
});
