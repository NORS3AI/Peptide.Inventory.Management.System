import { test, expect } from '@playwright/test';

test.describe('Dashboard View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should display dashboard heading', async ({ page }) => {
    await expect(page.locator('h2')).toContainText('Dashboard');
    await expect(page.locator('text=Overview of your peptide inventory')).toBeVisible();
  });

  test('should display stock status legend', async ({ page }) => {
    await expect(page.locator('text=Stock Status Legend')).toBeVisible();

    // Verify all status types are shown
    await expect(page.locator('text=Out of Stock')).toBeVisible();
    await expect(page.locator('text=Nearly Out')).toBeVisible();
    await expect(page.locator('text=Low Stock')).toBeVisible();
    await expect(page.locator('text=Good Stock')).toBeVisible();
    await expect(page.locator('text=On Order')).toBeVisible();
  });

  test('should display status actions', async ({ page }) => {
    await expect(page.locator('text=Order Immediately')).toBeVisible();
    await expect(page.locator('text=Order Urgently')).toBeVisible();
    await expect(page.locator('text=Order Soon')).toBeVisible();
    await expect(page.locator('text=No Action Needed')).toBeVisible();
    await expect(page.locator('text=Monitor Delivery')).toBeVisible();
  });

  test('should display quick stats', async ({ page }) => {
    await expect(page.locator('text=Total Peptides')).toBeVisible();
    await expect(page.locator('text=Need Ordering')).toBeVisible();
    await expect(page.locator('text=Need Labeling')).toBeVisible();
  });

  test('should show getting started or action items', async ({ page }) => {
    // Either getting started (for empty inventory) or action items (for populated inventory)
    const gettingStarted = page.locator('text=Getting Started');
    const actionItems = page.locator('text=Action Items');

    const hasGettingStarted = await gettingStarted.isVisible();
    const hasActionItems = await actionItems.isVisible();

    expect(hasGettingStarted || hasActionItems).toBeTruthy();
  });
});
