import { test, expect } from '@playwright/test';

test('GET /table/5 — page loads and shows table heading', async ({ page }) => {
  await page.goto('/table/5');
  // Wait for the tab bar to be present (data-testid from TableView)
  await expect(page.getByTestId('tab-bar')).toBeVisible({ timeout: 5000 });
  // The heading should mention the table number
  await expect(page.locator('body')).toContainText('5');
});

test('GET /staff — staff view loads', async ({ page }) => {
  await page.goto('/staff');
  await expect(page.getByTestId('staff-view')).toBeVisible({ timeout: 5000 });
});

test('EventSource /sse/tables/5 — receives an event within 2 seconds', async ({ page }) => {
  await page.goto('/staff'); // any page on our server will do

  const receivedEvent = await page.evaluate(() => {
    return new Promise<boolean>((resolve) => {
      const es = new EventSource('/sse/tables/5');
      const timer = setTimeout(() => {
        es.close();
        resolve(false);
      }, 2000);

      es.onmessage = () => {
        clearTimeout(timer);
        es.close();
        resolve(true);
      };

      // Also listen for named events (HELLO)
      es.addEventListener('HELLO', () => {
        clearTimeout(timer);
        es.close();
        resolve(true);
      });
    });
  });

  expect(receivedEvent).toBe(true);
});
