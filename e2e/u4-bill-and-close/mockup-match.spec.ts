/**
 * Mockup-match spec for U4 Table Bill (refined mockup S2, plus the loading, empty and error
 * states the mockup's state-coverage table lists).
 *
 * For each state it sets up the same data, checks the headings, labels, buttons, status words and
 * messages the mockup shows, and saves the app screenshot next to the mockup's own screenshot in
 * test-results/mockup-match/u4-bill-and-close/.
 *
 * Outside this Unit's comparison (owned by other Units): the Kitchen Board's "Table N →" header
 * link that opens the bill (U3) and the diner's "This table was closed" takeover (U2).
 * The mockup's "— none —" wording beside an enabled Close table is a placeholder: the functional
 * spec hides the note when nothing blocks closing, so the app shows no note there.
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';

const screenshotDir = path.join('test-results', 'mockup-match', 'u4-bill-and-close');

// Screens ease in; ask for reduced motion so every screenshot shows the finished screen, never a half-faded one.
test.use({ reducedMotion: 'reduce' });
const mockupPreview = path.resolve(
  'aidlc/spaces/default/intents/261105-table-order-app/inception/refined-mockups/preview.html'
);
const RUN = Date.now();
let keyCounter = 0;

test.beforeAll(() => {
  fs.mkdirSync(screenshotDir, { recursive: true });
});

test('mockup reference screenshot is saved beside the app screenshots', async ({ browser }) => {
  expect(fs.existsSync(mockupPreview), `mockup not found at ${mockupPreview}`).toBe(true);
  const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  await page.goto(pathToFileURL(mockupPreview).href);
  await page.screenshot({ path: path.join(screenshotDir, 'mockup-reference.png'), fullPage: true });
  await page.close();
});

async function placeOrder(request: APIRequestContext, baseURL: string, tableId: number, itemId: string, quantity: number) {
  const r = await request.post(`${baseURL}/api/tables/${tableId}/orders`, {
    data: { placement_key: `u4mm-${RUN}-${++keyCounter}`, lines: [{ menu_item_id: itemId, quantity }] },
  });
  expect(r.status()).toBe(201);
  return ((await r.json()) as { order_number: number }).order_number;
}

async function complete(request: APIRequestContext, baseURL: string, n: number) {
  for (const to of ['Preparing', 'Completed']) {
    const r = await request.post(`${baseURL}/api/orders/${n}/transition`, { data: { to, by: 'staff' } });
    expect(r.ok()).toBe(true);
  }
}

test.describe('Table Bill mockup-match', () => {
  test('S2 — two Completed orders: heading, Back link, status words, each prices, subtotals, Combined total, Close table', async ({ page, request, baseURL }) => {
    const url = baseURL!;
    // Same state as the mockup: two Completed orders on one table.
    const first = await placeOrder(request, url, 10, 'i-04', 2);
    await complete(request, url, first);
    const second = await placeOrder(request, url, 10, 'i-06', 1);
    await complete(request, url, second);

    await page.setViewportSize({ width: 1024, height: 900 });
    await page.goto('/staff/tables/10');
    await expect(page.getByTestId(`bill-order-${first}`)).toBeVisible({ timeout: 8000 });

    await expect(page.getByRole('heading', { name: 'Table 10 — Bill' })).toBeVisible();
    await expect(page.getByTestId('bill-back-link')).toHaveText('← Board');
    for (const n of [first, second]) {
      const card = page.getByTestId(`bill-order-${n}`);
      await expect(card).toContainText(`Order #${n}`);
      await expect(card).toContainText('✓');
      await expect(card).toContainText('Completed');
      await expect(card).toContainText('Placed');
      await expect(card).toContainText('each');
      await expect(card).toContainText('Subtotal');
      await expect(card).toContainText('$');
    }
    await expect(page.getByText('Combined total')).toBeVisible();
    await expect(page.getByTestId('bill-combined-total')).toHaveText('$42.50');
    await expect(page.getByRole('button', { name: 'Close table' })).toBeEnabled();

    await page.screenshot({ path: path.join(screenshotDir, 'bill-completed.png'), fullPage: true });
  });

  test('S2 — an open order: Close table disabled and the note lists the open order', async ({ page, request, baseURL }) => {
    const url = baseURL!;
    const open = await placeOrder(request, url, 8, 'i-04', 1);

    await page.goto('/staff/tables/8');
    await expect(page.getByTestId(`bill-order-${open}`)).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId(`bill-order-${open}`)).toContainText('Pending');
    await expect(page.getByRole('button', { name: 'Close table' })).toBeDisabled();
    await expect(page.getByText(`One or more orders still open: #${open}`)).toBeVisible();

    await page.screenshot({ path: path.join(screenshotDir, 'bill-open-order.png'), fullPage: true });

    // Leave the table tidy for any later run on the same server.
    await complete(request, url, open);
  });

  test('S2 — loading state: shimmer rows while the bill loads', async ({ page }) => {
    await page.route('**/api/tables/9/bill', async (route) => {
      await new Promise((r) => setTimeout(r, 1500));
      await route.continue();
    });
    await page.goto('/staff/tables/9');
    await expect(page.getByTestId('bill-loading')).toBeVisible({ timeout: 5000 });
    await page.screenshot({ path: path.join(screenshotDir, 'bill-loading.png'), fullPage: true });
  });

  test('S2 — empty state: "This table has no orders to close." and Close table disabled', async ({ page }) => {
    await page.route('**/api/tables/9/bill', (route) =>
      route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ table_id: 9, orders: [], combined_total_cents: 0, close_available: false, blocking_orders: [] }),
      })
    );
    await page.goto('/staff/tables/9');
    await expect(page.getByText('This table has no orders to close.')).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: 'Close table' })).toBeDisabled();

    await page.screenshot({ path: path.join(screenshotDir, 'bill-empty.png'), fullPage: true });
  });

  test('S2 — error state: "We cannot load the bill right now." with Retry', async ({ page }) => {
    await page.route('**/api/tables/9/bill', (route) =>
      route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ error: { code: 'INTERNAL_ERROR', message: 'x' } }) })
    );
    await page.goto('/staff/tables/9');
    await expect(page.getByText('We cannot load the bill right now.')).toBeVisible({ timeout: 8000 });
    await expect(page.getByRole('button', { name: 'Retry' })).toBeVisible();

    await page.screenshot({ path: path.join(screenshotDir, 'bill-error.png'), fullPage: true });
  });
});
