import { test, expect } from '@playwright/test';

test.describe('Web Dashboard E2E', () => {
  test.beforeEach(async ({ page }) => {
    // In a real E2E environment, we would seed the database or use a test account
    await page.goto('/login');
    await page.fill('input[name="email"]', 'dispatcher1@demo.cz');
    await page.fill('input[name="password"]', 'demo123');
    await page.click('button[type="submit"]');
  });

  test('should login and display the dashboard', async ({ page }) => {
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('h1')).toContainText('Dashboard');
    await expect(page.locator('text=Active Tasks')).toBeVisible();
    await expect(page.locator('text=Available Technicians')).toBeVisible();
  });

  test('should navigate to tasks page from dashboard', async ({ page }) => {
    await page.click('nav >> text=Tasks');
    await expect(page).toHaveURL(/\/dashboard\/tasks/);
    await expect(page.locator('h1')).toContainText('Tasks');
  });

  test('should logout successfully', async ({ page }) => {
    await page.click('button:has-text("User Profile")'); // Adjust selector as needed
    await page.click('text=Logout');
    await expect(page).toHaveURL(/\/login/);
  });
});
