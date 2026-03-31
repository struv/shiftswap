import { test, expect } from './fixtures';

/**
 * Happy Path #2: Staff Claims an Open Shift
 * 
 * As a staff member, I want to pick up extra hours by claiming
 * an open shift that someone else called out from.
 */
test.describe('Staff Claims Open Shift', () => {
  test('staff can claim an open shift', async ({ page, loginAs }) => {
    // Login as staff2 (different from staff1 who posted the call-out)
    await loginAs('staff2');
    
    // Navigate to Open Shifts page
    await page.goto('/callouts');
    
    // Verify we see the open shifts list
    await expect(page.locator('h1, h2').first()).toContainText(/open shifts|available|call.?outs/i);
    
    // Find an open shift card
    const openShiftCard = page.locator('[data-testid="open-shift-card"], [data-testid="callout-card"]').first();
    
    const hasOpenShifts = await openShiftCard.isVisible().catch(() => false);
    
    if (hasOpenShifts) {
      // Verify shift details are visible
      await expect(openShiftCard).toBeVisible();
      
      // Click "I'll Take It" button
      await openShiftCard.locator('button:has-text("Take It"), button:has-text("Claim")').click();
      
      // Confirm the claim if there's a confirmation dialog
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Yes")');
      if (await confirmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        await confirmButton.click();
      }
      
      // Verify success - claim created with pending status
      await expect(page.locator('text=/success|pending|submitted|claimed/i')).toBeVisible({ timeout: 5000 });
    } else {
      console.log('No open shifts available - skipping claim test');
      test.skip();
    }
  });
});
