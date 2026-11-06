/**
 * Mockup-match spec for U3 Kitchen Board (refined mockups S1, S1 empty state, S1a).
 *
 * For each mockup state it sets up the same data, checks the headings, labels,
 * buttons, status words and messages the mockup shows, and saves the app
 * screenshot next to the mockup's own screenshot in
 * test-results/mockup-match/u3-kitchen-board/.
 *
 * NOTE: The "Table N →" table bill link (navigating to /staff/tables/:id) is
 * U4 scope. This spec checks that the link renders, but not its destination.
 */

import { test, expect, type APIRequestContext } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const screenshotDir = path.join('test-results', 'mockup-match', 'u3-kitchen-board');
const mockupPreview = path.resolve(
  'aidlc/spaces/default/intents/261105-table-order-app/inception/refined-mockups/preview.html'
);

test.beforeAll(() => {
  fs.mkdirSync(screenshotDir, { recursive: true });
});

// Save the mockup's own screenshot beside the app's, once per spec run.
test('mockup reference screenshot is saved beside the app screenshots', async ({ browser }) => {
  expect(fs.existsSync(mockupPreview), `mockup not found at ${mockupPreview}`).toBe(true);
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(pathToFileURL(mockupPreview).href);
  await page.screenshot({ path: path.join(screenshotDir, 'mockup-reference.png'), fullPage: true });
  await page.close();
});

// Reset i-01 to available (prevents test pollution from availability toggles) and return its id.
async function getFirstMenuItemId(request: APIRequestContext, baseURL: string): Promise<string> {
  await request.post(`${baseURL}/api/menu/items/i-01/availability`, {
    data: { available: true },
  });
  return 'i-01';
}

async function placeOrder(
  request: APIRequestContext,
  baseURL: string,
  tableId: number,
  placementKey: string,
  itemId: string,
  quantity: number = 1
): Promise<number> {
  const r = await request.post(`${baseURL}/api/tables/${tableId}/orders`, {
    data: { placement_key: placementKey, lines: [{ menu_item_id: itemId, quantity }] },
  });
  const body = (await r.json()) as { order_number: number };
  return body.order_number;
}

async function transition(
  request: APIRequestContext,
  baseURL: string,
  orderNumber: number,
  to: 'Preparing' | 'Completed'
) {
  await request.post(`${baseURL}/api/orders/${orderNumber}/transition`, {
    data: { to, by: 'staff' },
  });
}

test.describe('Kitchen Board mockup-match', () => {
  test('S1 — header, ★ New highlight on a Pending order, Start preparing and Cancel buttons', async ({ page, request, baseURL }) => {
    const url = baseURL!;
    const itemId = await getFirstMenuItemId(request, url);
    const pendingOrder = await placeOrder(request, url, 1, `mm-pending-${Date.now()}`, itemId, 1);

    // Load the board AFTER the order exists: the mockup highlights every Pending order,
    // not only the ones that arrive while the board is open.
    await page.goto('/staff');
    await expect(page.getByTestId('kitchen-board')).toBeVisible({ timeout: 8000 });
    const card = page.getByTestId(`order-card-${pendingOrder}`);
    await expect(card).toBeVisible({ timeout: 8000 });

    // Header: title, "Updated live", Menu availability button
    await expect(page.locator('h1')).toContainText('Kitchen Board');
    await expect(page.getByText('Updated live')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Menu availability' })).toBeVisible();

    // Card: status word, ★ New, buttons
    await expect(card).toContainText('Pending');
    const highlight = card.locator('xpath=ancestor::*[@data-testid="new-highlight"][1]');
    await expect(highlight).toHaveAttribute('data-active', 'true');
    await expect(highlight.getByText('★ New')).toBeVisible();
    await expect(page.getByTestId(`btn-preparing-${pendingOrder}`)).toHaveText('Start preparing');
    await expect(page.getByTestId(`btn-cancel-${pendingOrder}`)).toHaveText('Cancel');

    // Table header link (its destination is U4 scope)
    await expect(page.getByText('Table 1 →')).toBeVisible();

    await page.screenshot({ path: path.join(screenshotDir, 'board-pending.png'), fullPage: true });
  });

  test('S1 — table cards sit side by side in a grid at desktop width', async ({ page, request, baseURL }) => {
    const url = baseURL!;
    const itemId = await getFirstMenuItemId(request, url);
    await placeOrder(request, url, 1, `mm-grid-1-${Date.now()}`, itemId, 1);
    await placeOrder(request, url, 2, `mm-grid-2-${Date.now()}`, itemId, 1);

    await page.setViewportSize({ width: 1280, height: 900 });
    await page.goto('/staff');
    const first = page.getByTestId('table-section-1');
    const second = page.getByTestId('table-section-2');
    await expect(first).toBeVisible({ timeout: 8000 });
    await expect(second).toBeVisible({ timeout: 8000 });

    const a = (await first.boundingBox())!;
    const b = (await second.boundingBox())!;
    // Same row (tops line up) and next to each other (second starts to the right of the first)
    expect(Math.abs(a.y - b.y)).toBeLessThan(4);
    expect(b.x).toBeGreaterThanOrEqual(a.x + a.width - 1);
  });

  test('S1 — Preparing order shows Mark completed and Cancel, no Start preparing, no ★ New', async ({ page, request, baseURL }) => {
    const url = baseURL!;
    const itemId = await getFirstMenuItemId(request, url);
    const preparingOrder = await placeOrder(request, url, 2, `mm-preparing-${Date.now()}`, itemId, 2);
    await transition(request, url, preparingOrder, 'Preparing');

    await page.goto('/staff');
    await expect(page.getByTestId('kitchen-board')).toBeVisible({ timeout: 8000 });
    const card = page.getByTestId(`order-card-${preparingOrder}`);
    await expect(card).toBeVisible({ timeout: 8000 });

    await expect(card).toContainText('Preparing');
    await expect(page.getByTestId(`btn-complete-${preparingOrder}`)).toHaveText('Mark completed');
    await expect(page.getByTestId(`btn-cancel-${preparingOrder}`)).toHaveText('Cancel');
    await expect(page.getByTestId(`btn-preparing-${preparingOrder}`)).not.toBeVisible();
    const highlight = card.locator('xpath=ancestor::*[@data-testid="new-highlight"][1]');
    await expect(highlight).toHaveAttribute('data-active', 'false');

    await page.screenshot({ path: path.join(screenshotDir, 'board-preparing.png'), fullPage: true });
  });

  test('S1 — Completed order shows its status word and no action buttons beside an open order', async ({ page, request, baseURL }) => {
    const url = baseURL!;
    const itemId = await getFirstMenuItemId(request, url);
    // Table 3: one Completed order and one open order (a table card shows only while it has an open order)
    const completedOrder = await placeOrder(request, url, 3, `mm-completed-${Date.now()}`, itemId, 1);
    await transition(request, url, completedOrder, 'Preparing');
    await transition(request, url, completedOrder, 'Completed');
    const openOrder = await placeOrder(request, url, 3, `mm-completed-open-${Date.now()}`, itemId, 1);

    await page.goto('/staff');
    await expect(page.getByTestId('kitchen-board')).toBeVisible({ timeout: 8000 });
    const card = page.getByTestId(`order-card-${completedOrder}`);
    await expect(card).toBeVisible({ timeout: 8000 });
    // Newest first: the open order is listed above the completed one
    const openBox = await page.getByTestId(`order-card-${openOrder}`).boundingBox();
    const doneBox = await card.boundingBox();
    expect(openBox!.y).toBeLessThan(doneBox!.y);

    await expect(card).toContainText('Completed');
    await expect(page.getByTestId(`btn-preparing-${completedOrder}`)).not.toBeVisible();
    await expect(page.getByTestId(`btn-complete-${completedOrder}`)).not.toBeVisible();
    await expect(page.getByTestId(`btn-cancel-${completedOrder}`)).not.toBeVisible();

    await page.screenshot({ path: path.join(screenshotDir, 'board-completed.png'), fullPage: true });
  });

  test('S1 — Cancel asks to confirm: "Cancel order #N?"', async ({ page, request, baseURL }) => {
    const url = baseURL!;
    const itemId = await getFirstMenuItemId(request, url);
    const order = await placeOrder(request, url, 4, `mm-cancel-${Date.now()}`, itemId, 1);

    await page.goto('/staff');
    await expect(page.getByTestId(`order-card-${order}`)).toBeVisible({ timeout: 8000 });

    await page.getByTestId(`btn-cancel-${order}`).click();
    await expect(page.getByTestId(`cancel-confirm-${order}`)).toBeVisible({ timeout: 3000 });
    await expect(page.getByText(`Cancel order #${order}?`)).toBeVisible();

    await page.screenshot({ path: path.join(screenshotDir, 'board-cancel-confirm.png'), fullPage: true });
  });

  test('S1 — empty state: "No open orders right now." and the 2-second note', async ({ page }) => {
    // Every table reports no open orders
    await page.route('**/api/tables/*/orders?visit=current', (route) =>
      route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ orders: [] }) })
    );

    await page.goto('/staff');
    await expect(page.getByTestId('kitchen-board')).toBeVisible({ timeout: 8000 });
    await expect(page.getByText('No open orders right now.', { exact: false })).toBeVisible({ timeout: 8000 });
    await expect(
      page.getByText('Orders will appear here within 2 seconds of placement.', { exact: false })
    ).toBeVisible();

    await page.screenshot({ path: path.join(screenshotDir, 'board-empty.png'), fullPage: true });
  });

  test('S1 — live-update disconnect banner appears when the connection drops', async ({ page }) => {
    // Block the live-update stream so the board cannot connect
    await page.route('**/sse/staff*', (route) => route.abort());

    await page.goto('/staff');
    await expect(page.getByTestId('kitchen-board')).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('reconnect-banner')).toBeVisible({ timeout: 12000 });
    await expect(page.getByTestId('reconnect-banner')).toContainText('Reconnecting…');

    await page.screenshot({ path: path.join(screenshotDir, 'board-disconnected.png'), fullPage: true });
  });

  test('S1a — Menu availability panel lists the items with a switch each and a Done button', async ({ page }) => {
    await page.goto('/staff');
    await expect(page.getByTestId('kitchen-board')).toBeVisible({ timeout: 8000 });

    await page.getByRole('button', { name: 'Menu availability' }).click();
    const panel = page.getByRole('dialog', { name: 'Menu availability' });
    await expect(panel).toBeVisible({ timeout: 5000 });

    await expect(panel.getByText('Done')).toBeVisible({ timeout: 3000 });
    const toggles = panel.locator('[data-testid^="availability-toggle-"]');
    await expect(toggles.first()).toBeVisible({ timeout: 5000 });
    // Twelve seed items, one switch each
    await expect(toggles).toHaveCount(12);

    await page.screenshot({ path: path.join(screenshotDir, 'menu-availability-panel.png'), fullPage: true });
  });
});
