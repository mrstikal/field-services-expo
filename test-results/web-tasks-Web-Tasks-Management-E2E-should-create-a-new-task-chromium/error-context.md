# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: web-tasks.spec.ts >> Web Tasks Management E2E >> should create a new task
- Location: e2e\playwright\web-tasks.spec.ts:12:7

# Error details

```
Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/login
Call log:
  - navigating to "http://localhost:3000/login", waiting until "load"

```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | test.describe('Web Tasks Management E2E', () => {
  4  |   test.beforeEach(async ({ page }) => {
> 5  |     await page.goto('/login');
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/login
  6  |     await page.fill('input[name="email"]', 'dispatcher1@demo.cz');
  7  |     await page.fill('input[name="password"]', 'demo123');
  8  |     await page.click('button[type="submit"]');
  9  |     await page.goto('/dashboard/tasks');
  10 |   });
  11 | 
  12 |   test('should create a new task', async ({ page }) => {
  13 |     await page.click('button:has-text("Create Task")');
  14 |     await page.fill('input[name="title"]', 'E2E Test Task');
  15 |     await page.fill('textarea[name="description"]', 'Task created by Playwright');
  16 |     await page.fill('input[name="address"]', 'Test Street 123');
  17 |     await page.selectOption('select[name="technician_id"]', { label: 'Technik 1' });
  18 |     await page.click('button[type="submit"]');
  19 | 
  20 |     await expect(page.locator('text=E2E Test Task')).toBeVisible();
  21 |   });
  22 | 
  23 |   test('should filter tasks by status', async ({ page }) => {
  24 |     await page.click('button:has-text("Filter")');
  25 |     await page.click('text=Completed');
  26 |     // Verify that only completed tasks are shown
  27 |     const rows = page.locator('table tr');
  28 |     const count = await rows.count();
  29 |     for (let i = 1; i < count; i++) {
  30 |         await expect(rows.nth(i)).toContainText('Completed');
  31 |     }
  32 |   });
  33 | 
  34 |   test('should view task details', async ({ page }) => {
  35 |     await page.click('table tr:nth-child(2) td:first-child');
  36 |     await expect(page).toHaveURL(/.*\/tasks\/.*/);
  37 |     await expect(page.locator('h1')).toBeVisible();
  38 |   });
  39 | });
  40 | 
```