/**
 * U4 browser tests: the table bill at /staff/tables/:id and the Close table action.
 *
 * Tables 7 to 10 only, so closing a table never disturbs the earlier Units' specs on the shared
 * test server. Every port comes from the Playwright config (E2E_PORT) through baseURL.
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import { resetTable } from '../build-and-test/helpers';

const RUN = Date.now();
let keyCounter = 0;

async function placeOrder(
  request: APIRequestContext,
  baseURL: string,
  tableId: number,
  items: Array<{ id: string; quantity: number }> = [{ id: 'i-04', quantity: 1 }]
): Promise<number> {
  const r = await request.post(`${baseURL}/api/tables/${tableId}/orders`, {
    data: {
      placement_key: `u4-${RUN}-${++keyCounter}`,
      lines: items.map((i) => ({ menu_item_id: i.id, quantity: i.quantity })),
    },
  });
  expect(r.status()).toBe(201);
  return ((await r.json()) as { order_number: number }).order_number;
}

async function transition(request: APIRequestContext, baseURL: string, n: number, to: string) {
  const r = await request.post(`${baseURL}/api/orders/${n}/transition`, { data: { to, by: 'staff' } });
  expect(r.ok()).toBe(true);
}

async function complete(request: APIRequestContext, baseURL: string, n: number) {
  await transition(request, baseURL, n, 'Preparing');
  await transition(request, baseURL, n, 'Completed');
}

test.describe('Table bill and Close table', () => {
  test('Flow 1: the bill lists every order with items, prices, subtotals and the combined total; a Cancelled order is not shown', async ({ page, request, baseURL }) => {
    const url = baseURL!;
    // Start from an empty table 7: this flow leaves its finished orders on it, so a second browser project
    // on the same server (playwright.cross-browser.config.ts) would otherwise see the first one's orders.
    await resetTable(request, url, 7);
    const a = await placeOrder(request, url, 7, [{ id: 'i-04', quantity: 2 }, { id: 'i-10', quantity: 1 }]);
    const b = await placeOrder(request, url, 7, [{ id: 'i-06', quantity: 1 }]);
    const cancelled = await placeOrder(request, url, 7, [{ id: 'i-12', quantity: 3 }]);
    await transition(request, url, cancelled, 'Cancelled');
    await complete(request, url, a);
    await complete(request, url, b);

    await page.goto('/staff/tables/7');
    await expect(page.getByRole('heading', { name: 'Table 7 — Bill' })).toBeVisible({ timeout: 8000 });

    const cardA = page.getByTestId(`bill-order-${a}`);
    await expect(cardA).toBeVisible();
    await expect(cardA).toContainText('Classic Burger');
    await expect(cardA).toContainText('× 2');
    await expect(cardA).toContainText('$14.50 each');
    await expect(cardA).toContainText('$29.00');
    await expect(cardA).toContainText('Sparkling Water');
    await expect(cardA).toContainText('Subtotal');
    await expect(cardA).toContainText('$32.50');
    await expect(cardA).toContainText('Completed');
    await expect(page.getByTestId(`bill-order-${b}`)).toContainText('$13.50');
    await expect(page.getByTestId(`bill-order-${cancelled}`)).toHaveCount(0);
    await expect(page.getByTestId('bill-combined-total')).toHaveText('$46.00');
    await expect(page.getByTestId('btn-close-table')).toBeEnabled();
  });

  test('Flow 2: Close table is disabled while an order is open and enables by itself when it is completed', async ({ page, request, baseURL }) => {
    const url = baseURL!;
    const n = await placeOrder(request, url, 8);

    await page.goto('/staff/tables/8');
    await expect(page.getByTestId(`bill-order-${n}`)).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('btn-close-table')).toBeDisabled();
    await expect(page.getByTestId('open-orders-note')).toContainText(`One or more orders still open: #${n}`);

    await transition(request, url, n, 'Preparing');
    await expect(page.getByTestId(`bill-order-${n}`)).toContainText('Preparing', { timeout: 3000 });
    await expect(page.getByTestId('btn-close-table')).toBeDisabled();

    await transition(request, url, n, 'Completed');
    await expect(page.getByTestId('btn-close-table')).toBeEnabled({ timeout: 3000 });
    await expect(page.getByTestId('open-orders-note')).toHaveCount(0);
  });

  test('Flow 3: a table with no orders shows an empty bill and a disabled Close table', async ({ page }) => {
    await page.goto('/staff/tables/9');
    await expect(page.getByRole('heading', { name: 'Table 9 — Bill' })).toBeVisible({ timeout: 8000 });
    await expect(page.getByTestId('bill-combined-total')).toHaveText('$0.00');
    await expect(page.getByTestId('btn-close-table')).toBeDisabled();
    await expect(page.getByTestId('open-orders-note')).toHaveText('This table has no orders to close.');
  });

  test('Flow 4: closing the table resets the diner screen, leaves the bill and clears the board', async ({ page, browser, request, baseURL }) => {
    const url = baseURL!;
    const n = await placeOrder(request, url, 10);
    await complete(request, url, n);

    const dinerContext = await browser.newContext();
    const diner = await dinerContext.newPage();
    await diner.goto('/table/10');
    await expect(diner.getByTestId('table-closed-takeover')).toHaveCount(0);

    await page.goto('/staff/tables/10');
    await expect(page.getByTestId('btn-close-table')).toBeEnabled({ timeout: 8000 });
    await page.getByTestId('btn-close-table').click();
    const modal = page.getByTestId('confirm-modal');
    await expect(modal).toContainText('Close Table 10?');
    await expect(modal).toContainText('Combined total: $14.50');
    await page.getByTestId('confirm-modal-confirm').click();

    await expect(diner.getByTestId('table-closed-takeover')).toBeVisible({ timeout: 3000 });
    await expect(diner.getByTestId('table-closed-takeover')).toContainText('This table was closed');
    await expect(page).toHaveURL(/\/staff$/, { timeout: 3000 });
    await expect(page.getByTestId('table-section-10')).toHaveCount(0);

    // The next visit starts clean: the old order is not on the new bill.
    const bill = await (await request.get(`${url}/api/tables/10/bill`)).json();
    expect(bill.orders).toEqual([]);
    await dinerContext.close();
  });

  test('Flow 5: closing a table another session already closed goes back to the board; Back returns to the board', async ({ page, request, baseURL }) => {
    const url = baseURL!;
    const n = await placeOrder(request, url, 8);
    await complete(request, url, n);

    await page.goto('/staff/tables/8');
    await expect(page.getByTestId('btn-close-table')).toBeEnabled({ timeout: 8000 });

    // Another session closes the table first; the open bill learns of it live and leaves.
    const closed = await request.post(`${url}/api/tables/8/close`, { data: {} });
    expect(closed.status()).toBe(200);
    await expect(page).toHaveURL(/\/staff$/, { timeout: 3000 });

    // Back link: open a bill and return.
    await page.goto('/staff/tables/9');
    await expect(page.getByTestId('bill-back-link')).toBeVisible({ timeout: 8000 });
    await page.getByTestId('bill-back-link').click();
    await expect(page).toHaveURL(/\/staff$/);
    await expect(page.getByTestId('kitchen-board')).toBeVisible();
  });

  test('Flow 5b: a close request on an already-closed table sends the staff member back to the board', async ({ page, request, baseURL }) => {
    const url = baseURL!;
    const n = await placeOrder(request, url, 8);
    await complete(request, url, n);

    await page.goto('/staff/tables/8');
    await expect(page.getByTestId('btn-close-table')).toBeEnabled({ timeout: 8000 });
    // The close request is answered as "already closed" (a second session won the race).
    await page.route('**/api/tables/8/close', (route) =>
      route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: { code: 'TABLE_ALREADY_CLOSED', message: 'closed' } }) })
    );
    await page.getByTestId('btn-close-table').click();
    await page.getByTestId('confirm-modal-confirm').click();
    await expect(page).toHaveURL(/\/staff$/, { timeout: 3000 });
  });
});
