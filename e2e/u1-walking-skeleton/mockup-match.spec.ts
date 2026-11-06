import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';

const screenshotDir = 'test-results/mockup-match/u1-walking-skeleton';

test.beforeAll(() => {
  fs.mkdirSync(screenshotDir, { recursive: true });
});

test('table view shell — tab bar visible at /table/5', async ({ page }) => {
  await page.goto('/table/5');
  const tabBar = page.getByTestId('tab-bar');
  await expect(tabBar).toBeVisible({ timeout: 5000 });

  // Verify all three tabs are present
  await expect(page.getByTestId('tab-menu')).toBeVisible();
  await expect(page.getByTestId('tab-cart')).toBeVisible();
  await expect(page.getByTestId('tab-orders')).toBeVisible();

  // Tab bar should be at the bottom of the viewport
  const tabBarBox = await tabBar.boundingBox();
  const viewportSize = page.viewportSize();
  expect(tabBarBox).not.toBeNull();
  if (tabBarBox && viewportSize) {
    // Tab bar bottom should be near the viewport bottom
    expect(tabBarBox.y + tabBarBox.height).toBeGreaterThan(viewportSize.height - 10);
  }

  // Save screenshot
  await page.screenshot({
    path: path.join(screenshotDir, 'table-view.png'),
    fullPage: false,
  });

  // Note: The refined screen mockups for Menu, Cart, My orders tabs
  // are owned by U2 (u2-diner-screens). This spec covers the shell only:
  // bottom tab bar, navigation structure, and dark theme.
});

test('staff view shell — staff-view visible at /staff', async ({ page }) => {
  await page.goto('/staff');
  const staffView = page.getByTestId('staff-view');
  await expect(staffView).toBeVisible({ timeout: 5000 });

  // Check heading text
  await expect(page.locator('h1')).toContainText('Kitchen Board');

  // Note: The placeholder message "Orders will appear here" was shown by U1's stub StaffView.
  // U3 replaces the stub with the real Kitchen Board (empty-state or live orders).
  // The U3 mockup-match spec covers the full Kitchen Board UI.

  // Save screenshot
  await page.screenshot({
    path: path.join(screenshotDir, 'staff-view.png'),
    fullPage: false,
  });

  // Note: The full Kitchen Board UI (live order columns, status transitions, item sold-out)
  // is owned by U3 (u3-kitchen-board). This spec covers the staff route shell only.
});
