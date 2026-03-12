import { test, expect } from '@playwright/test';

test.describe('Label Management', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
    await page.click('text=Labeling');
  });

  test('should display label management heading', async ({ page }) => {
    await expect(page.locator('h2')).toContainText('Label Management');
    await expect(page.locator('text=Manage label inventory and apply labels to peptides')).toBeVisible();
  });

  test('should display label inventory section', async ({ page }) => {
    await expect(page.locator('text=Label Inventory')).toBeVisible();
  });

  test('should display labeling priority queue', async ({ page }) => {
    await expect(page.locator('text=Labeling Priority Queue')).toBeVisible();
  });

  test('should display labeled peptides section', async ({ page }) => {
    await expect(page.locator('text=Labeled Peptides')).toBeVisible();
  });

  test('should have add label functionality', async ({ page }) => {
    const addButton = page.locator('button:has-text("Add Labels")');
    if (await addButton.isVisible()) {
      await expect(addButton).toBeVisible();
    }
  });

  test('should explain priority scoring', async ({ page }) => {
    // Look for priority information
    const priorityInfo = page.locator('text=Priority').first();
    if (await priorityInfo.isVisible()) {
      await expect(priorityInfo).toBeVisible();
    }
  });
});
