import { test, expect } from '@playwright/test';

test.describe('Web Tasks Management E2E', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
    await page.fill('input[name="email"]', 'dispatcher1@demo.cz');
    await page.fill('input[name="password"]', 'demo123');
    await page.click('button[type="submit"]');
    await page.goto('/dashboard/tasks');
  });

  test('should create a new task', async ({ page }) => {
    await page.click('button:has-text("Create Task")');
    await page.fill('input[name="title"]', 'E2E Test Task');
    await page.fill('textarea[name="description"]', 'Task created by Playwright');
    await page.fill('input[name="address"]', 'Test Street 123');
    await page.selectOption('select[name="technician_id"]', { label: 'Technik 1' });
    await page.click('button[type="submit"]');

    await expect(page.locator('text=E2E Test Task')).toBeVisible();
  });

  test('should filter tasks by status', async ({ page }) => {
    await page.click('button:has-text("Filter")');
    await page.click('text=Completed');
    // Verify that only completed tasks are shown
    const rows = page.locator('table tr');
    const count = await rows.count();
    for (let i = 1; i < count; i++) {
        await expect(rows.nth(i)).toContainText('Completed');
    }
  });

  test('should view task details', async ({ page }) => {
    await page.click('table tr:nth-child(2) td:first-child');
    await expect(page).toHaveURL(/.*\/tasks\/.*/);
    await expect(page.locator('h1')).toBeVisible();
  });
});
