import { test, expect } from '@playwright/test';
import { resetTable } from './helpers';

// Found by the keyboard journey in Build and Test: when the last open order of a table was marked
// completed, the table's card left the Kitchen Board, so there was no link left to its bill and the
// table could not be closed from the screens. It runs on table 4, which no other spec uses.

const TABLE_ID = 4;

test.afterEach(async ({ request, baseURL }) => {
  await resetTable(request, baseURL!, TABLE_ID);
});

test('regression: a table whose orders are all completed stays on the board until it is closed, so staff can open its bill', async ({ page, request, baseURL }) => {
  const url = baseURL!;
  await request.post(`${url}/api/menu/items/i-01/availability`, { data: { available: true } });

  const placed = await request.post(`${url}/api/tables/${TABLE_ID}/orders`, {
    data: { placement_key: `e2e-board-link-${Date.now()}`, lines: [{ menu_item_id: 'i-01', quantity: 1 }] },
  });
  expect(placed.status()).toBe(201);
  const { order_number } = (await placed.json()) as { order_number: number };
  for (const to of ['Preparing', 'Completed']) {
    const res = await request.post(`${url}/api/orders/${order_number}/transition`, { data: { to, by: 'staff' } });
    expect(res.status()).toBe(200);
  }

  await page.goto('/staff');
  await expect(page.getByTestId('kitchen-board')).toBeVisible({ timeout: 8000 });

  // The table is still on the board, its completed order marked Completed, with the link to its bill.
  const section = page.getByTestId(`table-section-${TABLE_ID}`);
  await expect(section).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId(`order-card-${order_number}`)).toContainText('Completed');
  await page.getByRole('link', { name: `Open bill for Table ${TABLE_ID}` }).click();
  await expect(page.getByTestId('table-bill-screen')).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId('btn-close-table')).toBeEnabled();

  // Closing it takes it off the board.
  await page.getByTestId('btn-close-table').click();
  await page.getByTestId('confirm-modal-confirm').click();
  await expect(page.getByTestId('kitchen-board')).toBeVisible({ timeout: 8000 });
  await expect(page.getByTestId(`table-section-${TABLE_ID}`)).toHaveCount(0);
});
