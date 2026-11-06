import { test, expect } from '@playwright/test';
import { resetTable } from './helpers';

// NFR1: new orders appear on the Kitchen Board within 2 seconds of placement (95th percentile, 10-order burst).
// NFR2: status changes reach the diner's "My orders" view within 2 seconds of the staff change (95th percentile).
// Both are measured in a real browser, from the moment the server answered the request to the moment the
// change is on screen. Runs on table 6 and closes it at the end, so no state is left behind.

const TABLE_ID = 6;
const LIMIT_MS = 2000;
const BURST = 10;

function percentile95(samples: number[]): number {
  const sorted = [...samples].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];
}

test('NFR1 and NFR2: a 10-order burst reaches the Kitchen Board, and each status change reaches My orders, within 2 seconds (p95)', async ({ browser, request, baseURL }) => {
  const url = baseURL!;
  await request.post(`${url}/api/menu/items/i-01/availability`, { data: { available: true } });

  // Start from an empty table 6, whatever an earlier spec left behind.
  await resetTable(request, url, TABLE_ID);

  const staff = await browser.newPage();
  const diner = await browser.newPage();
  try {
    await staff.goto('/staff');
    await expect(staff.getByTestId('kitchen-board')).toBeVisible({ timeout: 8000 });
    await expect(staff.getByTestId('kitchen-board')).toHaveAttribute('data-sse', 'connected', { timeout: 8000 });
    await diner.goto(`/table/${TABLE_ID}`);
    await expect(diner.getByTestId('menu-screen')).toBeVisible({ timeout: 8000 });
    await diner.getByTestId('tab-orders').click();
    await expect(diner.getByTestId('orders-empty')).toBeVisible();

    // NFR1: place 10 orders back to back and time each one's card on the board.
    const placedNumbers: number[] = [];
    const boardMs: number[] = [];
    for (let i = 0; i < BURST; i++) {
      const res = await request.post(`${url}/api/tables/${TABLE_ID}/orders`, {
        data: { placement_key: `e2e-timing-${Date.now()}-${i}`, lines: [{ menu_item_id: 'i-01', quantity: 1 }] },
      });
      expect(res.status()).toBe(201);
      const answeredAt = Date.now();
      const { order_number } = (await res.json()) as { order_number: number };
      placedNumbers.push(order_number);
      await expect(staff.getByTestId(`order-card-${order_number}`)).toBeVisible({ timeout: 6000 });
      boardMs.push(Date.now() - answeredAt);
    }
    console.log(`NFR1 board latency ms: ${boardMs.join(', ')} (p95 ${percentile95(boardMs)})`);
    expect(percentile95(boardMs)).toBeLessThanOrEqual(LIMIT_MS);

    // NFR2: move each order to Preparing and time how long My orders takes to show it.
    const dinerMs: number[] = [];
    for (const orderNumber of placedNumbers) {
      await expect(diner.getByTestId('orders-screen')).toContainText(`#${orderNumber}`, { timeout: 6000 });
      const res = await request.post(`${url}/api/orders/${orderNumber}/transition`, { data: { to: 'Preparing', by: 'staff' } });
      expect(res.status()).toBe(200);
      const answeredAt = Date.now();
      await expect
        .poll(async () => {
          const text = (await diner.getByTestId('orders-screen').innerText()).replace(/\s+/g, ' ');
          const from = text.indexOf(`#${orderNumber}`);
          return from >= 0 && /Preparing/.test(text.slice(from, from + 80));
        }, { timeout: 6000, intervals: [50] })
        .toBe(true);
      dinerMs.push(Date.now() - answeredAt);
    }
    console.log(`NFR2 diner latency ms: ${dinerMs.join(', ')} (p95 ${percentile95(dinerMs)})`);
    expect(percentile95(dinerMs)).toBeLessThanOrEqual(LIMIT_MS);

    // Leave table 6 as it was found: finish and close it.
    for (const orderNumber of placedNumbers) {
      await request.post(`${url}/api/orders/${orderNumber}/transition`, { data: { to: 'Completed', by: 'staff' } });
    }
    const closed = await request.post(`${url}/api/tables/${TABLE_ID}/close`, { data: {} });
    expect(closed.status()).toBe(200);
  } finally {
    await staff.close();
    await diner.close();
    await resetTable(request, url, TABLE_ID);
  }
});
