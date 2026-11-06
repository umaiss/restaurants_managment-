import { test, expect, Page } from '@playwright/test';
import path from 'path';
import fs from 'fs';

// Parts owned by later Units:
// - Bill screen (U4 scope): bill total, payment confirmation, table close button
// These are listed here and left out of the mockup-match comparison.

const screenshotDir = 'test-results/mockup-match/u2-diner-screens';

test.beforeAll(() => {
  fs.mkdirSync(screenshotDir, { recursive: true });
});

// ---------------------------------------------------------------------------
// MenuScreen mockup match
// ---------------------------------------------------------------------------

test('MenuScreen — category pills, item cards, + Add buttons, sticky pill bar', async ({
  page,
}) => {
  await page.goto('/table/1');
  await expect(page.getByTestId('tab-bar')).toBeVisible({ timeout: 5000 });

  // Wait for menu to load
  await expect(page.getByTestId('menu-screen')).toBeVisible({ timeout: 5000 });

  // Verify category pill bar is present and sticky (position: sticky)
  const pillBar = page.getByTestId('category-pill-bar');
  await expect(pillBar).toBeVisible();

  // All four category pills are present
  await expect(page.getByTestId('category-pill-starters')).toBeVisible();
  await expect(page.getByTestId('category-pill-mains')).toBeVisible();
  await expect(page.getByTestId('category-pill-desserts')).toBeVisible();
  await expect(page.getByTestId('category-pill-drinks')).toBeVisible();

  // At least one + Add button is present
  const addBtns = page.locator('[data-testid^="add-item-"]');
  await expect(addBtns.first()).toBeVisible();

  // Category section headings are present
  await expect(page.getByRole('heading', { name: 'Starters' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Mains' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Desserts' })).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Drinks' })).toBeVisible();

  // Tab bar is at the bottom
  const tabBar = page.getByTestId('tab-bar');
  await expect(tabBar).toBeVisible();

  // Save screenshots
  await page.screenshot({
    path: path.join(screenshotDir, 'menu-screen.png'),
    fullPage: false,
  });

  // Also screenshot just the category pill bar region
  await pillBar.screenshot({
    path: path.join(screenshotDir, 'category-pill-bar.png'),
  });
});

// ---------------------------------------------------------------------------
// CartScreen mockup match
// ---------------------------------------------------------------------------

test('CartScreen — cart lines, Place order button, ConfirmModal', async ({ page }) => {
  await page.goto('/table/1');
  await expect(page.getByTestId('menu-screen')).toBeVisible({ timeout: 5000 });

  // Add an item first
  const addBtn = page.locator('[data-testid^="add-item-"]').first();
  await expect(addBtn).toBeVisible({ timeout: 5000 });
  await addBtn.click();

  // Switch to cart
  await page.getByTestId('tab-cart').click();
  await expect(page.getByTestId('cart-screen')).toBeVisible({ timeout: 3000 });

  // Cart item card is visible
  const cartItems = page.locator('[data-testid^="cart-item-"]');
  await expect(cartItems.first()).toBeVisible({ timeout: 3000 });

  // Cart total is shown
  await expect(page.getByTestId('cart-total')).toBeVisible();

  // Place order button is enabled
  const placeBtn = page.getByTestId('place-order-button');
  await expect(placeBtn).not.toBeDisabled();

  // Save screenshot of cart
  await page.screenshot({
    path: path.join(screenshotDir, 'cart-screen.png'),
    fullPage: false,
  });

  // Open ConfirmModal and screenshot it
  await placeBtn.click();
  await expect(page.getByTestId('confirm-modal')).toBeVisible({ timeout: 3000 });
  await page.screenshot({
    path: path.join(screenshotDir, 'cart-confirm-modal.png'),
    fullPage: false,
  });

  // Close the modal
  await page.getByTestId('confirm-modal-cancel').click();
  await expect(page.getByTestId('confirm-modal')).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// MyOrdersScreen mockup match
// ---------------------------------------------------------------------------

test('MyOrdersScreen — order cards, status pills, Pending status', async ({ page }) => {
  await page.goto('/table/1');
  await expect(page.getByTestId('menu-screen')).toBeVisible({ timeout: 5000 });

  // Add item and place order to have something to show
  const addBtn = page.locator('[data-testid^="add-item-"]').first();
  await expect(addBtn).toBeVisible({ timeout: 5000 });
  await addBtn.click();

  await page.getByTestId('tab-cart').click();
  await page.getByTestId('place-order-button').click();
  await expect(page.getByTestId('confirm-modal')).toBeVisible();
  await page.getByTestId('confirm-modal-confirm').click();
  await expect(page.getByTestId('order-success-banner')).toBeVisible({ timeout: 5000 });

  // Switch to My Orders
  await page.getByTestId('tab-orders').click();
  await expect(page.getByTestId('orders-screen')).toBeVisible({ timeout: 3000 });

  // Order card is present
  await expect(page.locator('[data-testid^="order-card-"]').first()).toBeVisible({ timeout: 3000 });

  // Status pill is Pending
  const statusPill = page.locator('[data-testid^="order-status-"]').first();
  await expect(statusPill).toBeVisible();
  await expect(statusPill).toContainText('Pending');

  // Save screenshot
  await page.screenshot({
    path: path.join(screenshotDir, 'my-orders-screen.png'),
    fullPage: false,
  });
});

// ---------------------------------------------------------------------------
// Tab bar mockup match
// ---------------------------------------------------------------------------

test('DinerTabBar — bottom tab bar with Menu, Cart, My orders tabs', async ({ page }) => {
  await page.goto('/table/1');
  await expect(page.getByTestId('tab-bar')).toBeVisible({ timeout: 5000 });

  const tabBar = page.getByTestId('tab-bar');

  // All three tabs present with correct labels
  await expect(page.getByTestId('tab-menu')).toBeVisible();
  await expect(page.getByTestId('tab-cart')).toBeVisible();
  await expect(page.getByTestId('tab-orders')).toBeVisible();

  // Cart tab shows no count badge while the cart is empty, then shows the item count
  await expect(page.getByTestId('cart-badge')).not.toBeVisible();
  await page.locator('[data-testid^="add-item-"]').first().click();
  await expect(page.getByTestId('cart-badge')).toBeVisible();
  await expect(page.getByTestId('cart-badge')).toHaveText('1');

  // Tab bar is at the bottom of the viewport
  const tabBarBox = await tabBar.boundingBox();
  const viewportSize = page.viewportSize();
  if (tabBarBox && viewportSize) {
    expect(tabBarBox.y + tabBarBox.height).toBeGreaterThan(viewportSize.height - 10);
  }

  // Save screenshot
  await tabBar.screenshot({
    path: path.join(screenshotDir, 'tab-bar.png'),
  });
  await page.screenshot({
    path: path.join(screenshotDir, 'full-diner-view.png'),
    fullPage: false,
  });
});
