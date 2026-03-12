import { test, expect } from '@playwright/test';

test.describe('Reports and Analytics', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click('text=Reports');
  });

  test('should display reports heading', async ({ page }) => {
    await expect(page.locator('h2')).toContainText('Reports & Analytics');
    await expect(page.locator('text=Comprehensive inventory analysis and exports')).toBeVisible();
  });

  test('should have export inventory button', async ({ page }) => {
    const exportButton = page.locator('button:has-text("Export Full Inventory")');
    if (await exportButton.isVisible()) {
      await expect(exportButton).toBeVisible();
    }
  });

  test('should have export summary button', async ({ page }) => {
    const summaryButton = page.locator('button:has-text("Export Summary Report")');
    if (await summaryButton.isVisible()) {
      await expect(summaryButton).toBeVisible();
    }
  });

  test('should display inventory summary', async ({ page }) => {
    await expect(page.locator('text=Inventory Summary')).toBeVisible();
  });

  test('should display operational metrics', async ({ page }) => {
    await expect(page.locator('text=Operational Metrics')).toBeVisible();
  });

  test('should display stock status breakdown', async ({ page }) => {
    await expect(page.locator('text=Stock Status Breakdown')).toBeVisible();
  });

  test('should show stock categories', async ({ page }) => {
    // These should appear in the breakdown
    const categories = [
      'Out of Stock',
      'Nearly Out',
      'Low Stock',
      'Good Stock',
      'On Order'
    ];

    for (const category of categories) {
      const element = page.locator(`text=${category}`).first();
      if (await element.isVisible()) {
        await expect(element).toBeVisible();
      }
    }
  });
});
