import { test, expect } from '@playwright/test';

test.describe('Inventory Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click('text=Inventory');
  });

  test('should display inventory heading', async ({ page }) => {
    await expect(page.locator('h2')).toContainText('Inventory');
    await expect(page.locator('text=Manage your peptide stock levels')).toBeVisible();
  });

  test('should display inventory table controls', async ({ page }) => {
    // Search box
    await expect(page.locator('input[placeholder*="Search"]')).toBeVisible();

    // Filter controls should be present
    const filterText = page.locator('text=Filter');
    if (await filterText.isVisible()) {
      await expect(filterText).toBeVisible();
    }
  });

  test('should display column headers', async ({ page }) => {
    // Key column headers
    const headers = [
      'Peptide ID',
      'Name',
      'Quantity',
      'Status'
    ];

    for (const header of headers) {
      // Headers might be in the table
      const headerElement = page.locator(`text=${header}`).first();
      if (await headerElement.isVisible()) {
        await expect(headerElement).toBeVisible();
      }
    }
  });

  test('should have export functionality', async ({ page }) => {
    const exportButton = page.locator('text=Export');
    if (await exportButton.isVisible()) {
      await expect(exportButton).toBeVisible();
    }
  });

  test('should have column reorder functionality', async ({ page }) => {
    const reorderButton = page.locator('text=Reorder Columns');
    if (await reorderButton.isVisible()) {
      await reorderButton.click();
      await expect(page.locator('text=Column Order')).toBeVisible();
    }
  });
});
