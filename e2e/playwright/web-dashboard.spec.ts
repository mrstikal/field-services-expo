import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

async function signInAsDispatcher(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('dispatcher1@demo.cz');
  await page.getByLabel('Password').fill('demo123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(
    page.getByRole('heading', { name: 'Dashboard Overview' })
  ).toBeVisible();
}

test.describe('Web Dashboard E2E', () => {
  test.beforeEach(async ({ page }) => {
    await signInAsDispatcher(page);
  });

  test('should login and display the dashboard', async ({ page }) => {
    await expect(
      page.getByRole('heading', { name: 'Dashboard Overview' })
    ).toBeVisible();
    await expect(page.getByText('Assigned Tasks')).toBeVisible();
    await expect(page.getByText('Online Technicians')).toBeVisible();
  });

  test('should navigate to tasks page from dashboard', async ({ page }) => {
    await page.getByRole('link', { name: 'Tasks' }).click();
    await expect(page).toHaveURL(/\/dashboard\/tasks/);
    await expect(
      page.getByRole('heading', { name: 'Tasks Management' })
    ).toBeVisible();
  });

  test('should logout successfully', async ({ page }) => {
    await page.getByRole('button', { name: 'Sign Out' }).click();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole('button', { name: 'Sign in' })).toBeVisible();
  });
});
