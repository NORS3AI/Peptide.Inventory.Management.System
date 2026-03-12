import { test, expect } from '@playwright/test';

test.describe('Navigation and State Persistence', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
    await page.waitForLoadState('networkidle');
  });

  test('should load the application', async ({ page }) => {
    await expect(page.locator('h1')).toContainText('Oath Research');
    await expect(page.locator('text=Peptide Inventory System')).toBeVisible();
  });

  test('should display all navigation tabs', async ({ page }) => {
    const tabs = [
      'Dashboard',
      'Inventory',
      'Labeling',
      'Sales Ready',
      'Reports',
      'Import CSV'
    ];

    for (const tab of tabs) {
      await expect(page.locator(`text=${tab}`)).toBeVisible();
    }
  });

  test('should navigate between tabs', async ({ page }) => {
    // Navigate to Inventory
    await page.click('text=Inventory');
    await expect(page.locator('h2')).toContainText('Inventory');

    // Navigate to Labeling
    await page.click('text=Labeling');
    await expect(page.locator('h2')).toContainText('Label Management');

    // Navigate to Sales Ready
    await page.click('text=Sales Ready');
    await expect(page.locator('h2')).toContainText('Sales Ready Validation');

    // Navigate to Reports
    await page.click('text=Reports');
    await expect(page.locator('h2')).toContainText('Reports & Analytics');

    // Navigate to Import CSV
    await page.click('text=Import CSV');
    await expect(page.locator('h2')).toContainText('Import CSV');

    // Navigate back to Dashboard
    await page.click('text=Dashboard');
    await expect(page.locator('h2')).toContainText('Dashboard');
  });

  test('should highlight active tab', async ({ page }) => {
    // Click Inventory tab
    await page.click('text=Inventory');

    // Verify Inventory tab has active styling
    const inventoryTab = page.locator('button:has-text("Inventory")');
    const classes = await inventoryTab.getAttribute('class');
    expect(classes).toContain('text-blue-600');
  });

  test('should display dark mode toggle', async ({ page }) => {
    // Look for dark mode button (has Sun or Moon icon)
    const darkModeButton = page.locator('button[aria-label="Toggle dark mode"]');
    await expect(darkModeButton).toBeVisible();
  });

  test('should toggle dark mode', async ({ page }) => {
    const darkModeButton = page.locator('button[aria-label="Toggle dark mode"]');

    // Get initial state
    const htmlElement = page.locator('html');
    const initialClasses = await htmlElement.getAttribute('class') || '';
    const initiallyDark = initialClasses.includes('dark');

    // Toggle dark mode
    await darkModeButton.click();

    // Wait a bit for the transition
    await page.waitForTimeout(100);

    // Verify dark mode toggled
    const newClasses = await htmlElement.getAttribute('class') || '';
    const nowDark = newClasses.includes('dark');

    expect(nowDark).toBe(!initiallyDark);
  });

  test('should persist dark mode preference', async ({ page, context }) => {
    const darkModeButton = page.locator('button[aria-label="Toggle dark mode"]');

    // Toggle dark mode
    await darkModeButton.click();
    await page.waitForTimeout(100);

    // Get current dark mode state
    const htmlElement = page.locator('html');
    const classes = await htmlElement.getAttribute('class') || '';
    const isDark = classes.includes('dark');

    // Reload page
    await page.reload();
    await page.waitForLoadState('networkidle');

    // Verify dark mode persisted
    const newClasses = await htmlElement.getAttribute('class') || '';
    const stillDark = newClasses.includes('dark');

    expect(stillDark).toBe(isDark);
  });

  test('should display version number', async ({ page }) => {
    await expect(page.locator('text=v1.0.0')).toBeVisible();
  });

  test('should display footer', async ({ page }) => {
    await expect(page.locator('text=© 2026 Oath Research')).toBeVisible();
  });
});
