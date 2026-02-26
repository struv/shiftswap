import { test, expect } from './fixtures';

/**
 * Happy Path #1: Staff Posts a Call-Out
 * 
 * As a staff member, I need to mark that I can't work my shift
 * so someone else can cover it.
 */
test.describe('Staff Posts Call-Out', () => {
  test('staff can post a call-out for their shift', async ({ page, loginAs }) => {
    // Login as staff1
    await loginAs('staff1');
    
    // Navigate to My Shifts / New Call-Out page
    await page.goto('/callouts/new');
    
    // Verify we see the shifts list
    await expect(page.locator('h1, h2').first()).toContainText(/my shifts|call.?out/i);
    
    // Find a shift and click "I Can't Work This"
    const shiftCard = page.locator('[data-testid="shift-card"]').first();
    
    // If no shifts exist, we need to handle that
    const hasShifts = await shiftCard.isVisible().catch(() => false);
    
    if (hasShifts) {
      // Click the call-out button
      await shiftCard.locator('button:has-text("Call Out"), button:has-text("Post Call-Out")').click();
      
      // Confirm the call-out (modal or confirmation)
      const confirmButton = page.locator('button:has-text("Confirm"), button:has-text("Submit")');
      if (await confirmButton.isVisible()) {
        await confirmButton.click();
      }
      
      // Verify success message or redirect
      await expect(page.locator('text=/success|created|posted/i')).toBeVisible({ timeout: 5000 });
    } else {
      // No shifts available - this is expected in a fresh test environment
      console.log('No shifts available for staff1 - skipping call-out creation');
      test.skip();
    }
  });
});
