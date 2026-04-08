import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';

const SEEDED_TASK_TITLE = 'Switchboard maintenance';

async function openTasksPage(page: Page) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    if (!page.url().includes('/dashboard/tasks')) {
      await page.getByRole('link', { name: 'Tasks' }).click();
      await expect(page).toHaveURL(/\/dashboard\/tasks/);
    }

    await expect(
      page.getByRole('heading', { name: 'Tasks Management' })
    ).toBeVisible();

    const unauthorizedMessage = page.getByText('Error: Unauthorized');
    if (await unauthorizedMessage.isVisible().catch(() => false)) {
      await page.reload();
      continue;
    }

    const seededTask = page.getByText(SEEDED_TASK_TITLE);
    if (await seededTask.isVisible().catch(() => false)) {
      return;
    }

    await page.reload();
  }

  await expect(page.getByText(SEEDED_TASK_TITLE)).toBeVisible();
}

async function signInAndOpenTasks(page: Page) {
  await page.goto('/login');
  await page.getByLabel('Email').fill('dispatcher2@demo.cz');
  await page.getByLabel('Password').fill('demo123');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await expect(page).toHaveURL(/\/dashboard/);
  await expect(
    page.getByRole('heading', { name: 'Dashboard Overview' })
  ).toBeVisible();
  await openTasksPage(page);
}

test.describe('Web Tasks Management E2E', () => {
  test.beforeEach(async ({ page }) => {
    await signInAndOpenTasks(page);
  });

  test('should create a new task', async ({ page }) => {
    const taskTitle = `[E2E] Playwright Task ${Date.now()}`;

    await page.getByRole('button', { name: 'Create New Task' }).click();
    await expect(
      page.getByRole('heading', { name: 'Create New Task' }).last()
    ).toBeVisible();

    await page.getByLabel('Task Title *').fill(taskTitle);
    await page.getByLabel('Customer Name *').fill('Playwright Customer');
    await page.getByLabel('Customer Phone *').fill('+420123456789');
    await page.getByLabel('Address *').fill('Playwright Street 123');
    await page
      .getByLabel('Work Description *')
      .fill('Task created by Playwright');

    await page.getByRole('button', { name: 'Create' }).click();
    await expect(
      page.getByRole('heading', { name: 'Create New Task' }).last()
    ).not.toBeVisible();
    await expect(page.getByText(taskTitle)).toBeVisible();
  });

  test('should filter tasks by status', async ({ page }) => {
    await page.getByRole('button', { name: 'Assigned' }).click();
    await expect(
      page.getByRole('heading', { name: /assigned tasks/i })
    ).toBeVisible();
    await expect(page.getByText('assigned').first()).toBeVisible();
  });

  test('should open edit dialog for an existing task', async ({ page }) => {
    await page.getByRole('button', { name: 'Edit' }).first().click();
    await expect(
      page.getByRole('heading', { name: 'Edit Task' }).last()
    ).toBeVisible();
  });
});
