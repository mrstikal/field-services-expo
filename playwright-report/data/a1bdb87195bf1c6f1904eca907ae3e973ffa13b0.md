# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: web-dashboard.spec.ts >> Web Dashboard E2E >> should navigate to tasks page from dashboard
- Location: e2e\playwright\web-dashboard.spec.ts:19:7

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
  3  | test.describe('Web Dashboard E2E', () => {
  4  |   test.beforeEach(async ({ page }) => {
  5  |     // In a real E2E environment, we would seed the database or use a test account
> 6  |     await page.goto('/login');
     |                ^ Error: page.goto: net::ERR_CONNECTION_REFUSED at http://localhost:3000/login
  7  |     await page.fill('input[name="email"]', 'dispatcher1@demo.cz');
  8  |     await page.fill('input[name="password"]', 'demo123');
  9  |     await page.click('button[type="submit"]');
  10 |   });
  11 | 
  12 |   test('should login and display the dashboard', async ({ page }) => {
  13 |     await expect(page).toHaveURL(/\/dashboard/);
  14 |     await expect(page.locator('h1')).toContainText('Dashboard');
  15 |     await expect(page.locator('text=Active Tasks')).toBeVisible();
  16 |     await expect(page.locator('text=Available Technicians')).toBeVisible();
  17 |   });
  18 | 
  19 |   test('should navigate to tasks page from dashboard', async ({ page }) => {
  20 |     await page.click('nav >> text=Tasks');
  21 |     await expect(page).toHaveURL(/\/dashboard\/tasks/);
  22 |     await expect(page.locator('h1')).toContainText('Tasks');
  23 |   });
  24 | 
  25 |   test('should logout successfully', async ({ page }) => {
  26 |     await page.click('button:has-text("User Profile")'); // Adjust selector as needed
  27 |     await page.click('text=Logout');
  28 |     await expect(page).toHaveURL(/\/login/);
  29 |   });
  30 | });
  31 | 
```