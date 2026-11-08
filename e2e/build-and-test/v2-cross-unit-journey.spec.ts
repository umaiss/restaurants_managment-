import { test, expect, type APIRequestContext, type Browser, type Page } from '@playwright/test';
import { endSpecial } from '../helpers';
import { resetTable } from './helpers';

// Cross-unit integration of v2: the diner side (U6) and the staff side (U7) together, in one story.
// Each Unit was built and tested with only v1 and U5 in the project, so this is the first time the two sides
// meet. Both sides are driven through their real screens. The 2-second live rule is checked with real limits
// and no fixed sleeps: every wait is for something the page shows.
// It runs on its own table (3), reset first so earlier specs' orders do not leak in.

const TABLE_ID = 3;
const LIVE = 2000; // the 2-second rule for a live change
const LIVE_SLACK = 3000; // a live change that goes through more than one request or screen

const money = (cents: number) => `$${Math.floor(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
const plural = (n: number, one: string) => `${n} ${n === 1 ? one : `${one}s`}`;
const localDay = (d = new Date()) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

interface SalesDay {
  day: string;
  visits: number;
  orders: number;
  total_cents: number;
}

async function todaysSales(request: APIRequestContext): Promise<SalesDay> {
  const res = await request.get('/api/staff/sales');
  expect(res.ok(), 'reading the sales report').toBe(true);
  const { days } = (await res.json()) as { days: SalesDay[] };
  return days.find((d) => d.day === localDay()) ?? { day: localDay(), visits: 0, orders: 0, total_cents: 0 };
}

async function orderStatus(request: APIRequestContext, orderNumber: number): Promise<string> {
  const res = await request.get(`/api/tables/${TABLE_ID}/orders?visit=current`);
  const { orders } = (await res.json()) as { orders: Array<{ order_number: number; status: string }> };
  return orders.find((o) => o.order_number === orderNumber)?.status ?? 'none';
}

async function dinerPage(browser: Browser, baseURL: string): Promise<Page> {
  const context = await browser.newContext({ baseURL });
  return context.newPage();
}

test.describe('v2 cross-unit journey: diner and staff together', () => {
  test.beforeEach(async ({ request, baseURL }) => {
    await resetTable(request, baseURL!, TABLE_ID);
    await endSpecial(request);
    await request.post('/api/menu/items/i-11/availability', { data: { available: true } });
  });
  test.afterEach(async ({ request, baseURL }) => {
    await endSpecial(request).catch(() => undefined);
    await resetTable(request, baseURL!, TABLE_ID);
  });

  test('menu change, order with options, call, stations, ready banner, special, floor, bill, close, ratings and sales', async ({ page: staff, browser, request, baseURL }) => {
    test.setTimeout(180_000);
    // A name that sorts first among equally rated dishes, so repeated runs on one server still show it (newest first).
    const ITEM_NAME = `Aa Stew ${String(10 ** 14 - Date.now())}`;
    const QTY = 6;
    const diner = await dinerPage(browser, baseURL!);

    try {
      // ---------------------------------------------------------------- 0. a diner opens the table: the floor map says Browsing
      await diner.goto(`/table/${TABLE_ID}`);
      await expect(diner.getByTestId('menu-screen')).toBeVisible({ timeout: 8000 });
      await staff.goto('/staff/floor');
      await expect(staff.getByTestId('floor-table-3'), 'a table with an open diner page and no order').toContainText('Browsing', { timeout: 3000 });

      // ---------------------------------------------------------------- 1. staff add an item with an option (U7); the open diner Menu (U6) shows it live
      await staff.goto('/staff/menu');
      await expect(staff.getByTestId('menu-management')).toBeVisible();
      await staff.getByTestId('add-item').click();
      await staff.getByLabel('Name', { exact: true }).fill(ITEM_NAME);
      await staff.getByLabel('Description').fill('Added by the cross-unit test');
      await staff.getByLabel('Price (dollars)').fill('9.50');
      await staff.getByLabel('Station').selectOption('Grill');
      await staff.getByRole('button', { name: 'Add option group' }).click();
      await staff.getByLabel('Group name').fill('Doneness');
      await staff.getByLabel('Choice 1', { exact: true }).fill('Medium');
      await staff.getByLabel('Price change ($)').fill('0.00');
      await staff.getByRole('button', { name: 'Add choice' }).click();
      await staff.getByLabel('Choice 2', { exact: true }).fill('Well done');
      await staff.getByLabel('Price change ($)').nth(1).fill('1.50');
      await staff.getByLabel('Required').check();
      await staff.getByTestId('save-item').click();

      const card = diner.locator('[data-testid^="menu-item-"]').filter({ hasText: ITEM_NAME });
      await expect(card, 'the new item shows on the open diner Menu within 2 seconds, with no reload').toBeVisible({ timeout: LIVE });
      await expect(card.locator('[data-testid^="make-it-yours-"]'), 'the new item carries its option ("Make it yours")').toBeVisible({ timeout: LIVE });
      await expect(staff.getByTestId('item-form')).toHaveCount(0);
      const itemId = ((await card.getAttribute('data-testid')) ?? '').replace('menu-item-', '');
      expect(itemId, 'the diner card names the new item id').not.toBe('');

      // ---------------------------------------------------------------- 2. the diner orders it with the option and a drink; the Kitchen Board shows it
      await staff.goto('/staff');
      await expect(staff.getByTestId('kitchen-board')).toHaveAttribute('data-sse', 'connected', { timeout: 8000 });

      await diner.getByTestId(`add-item-${itemId}`).click();
      await expect(diner.getByTestId('options-sheet')).toBeVisible();
      await expect(diner.getByTestId('options-add'), 'a required group blocks Add to cart').toBeDisabled();
      await diner.getByRole('radio', { name: /Well done/ }).click();
      await expect(diner.getByTestId('options-price')).toHaveText('$11.00'); // 9.50 + 1.50
      await diner.getByTestId('options-add').click();
      await diner.getByTestId('add-item-i-11').click();
      await diner.getByTestId('tab-cart').click();
      const stewLine = diner.locator('[data-testid^="cart-item-"]').filter({ hasText: ITEM_NAME });
      for (let i = 1; i < QTY; i++) await stewLine.locator('[data-testid^="cart-increase-"]').click();
      await expect(stewLine.locator('[data-testid^="cart-qty-"]')).toHaveText(String(QTY));
      const orderTotal = QTY * 1100 + 450;
      await expect(diner.getByTestId('cart-total')).toHaveText(money(orderTotal));
      await diner.getByTestId('place-order-button').click();
      await diner.getByTestId('confirm-modal-confirm').click();
      await expect(diner.getByTestId('orders-screen')).toBeVisible({ timeout: 8000 });

      const placed = (await (await request.get(`/api/tables/${TABLE_ID}/orders?visit=current`)).json()) as { orders: Array<{ order_number: number }> };
      expect(placed.orders).toHaveLength(1);
      const orderNo = placed.orders[0].order_number;

      const boardCard = staff.getByTestId(`order-card-${orderNo}`);
      await expect(boardCard, 'the order reaches the Kitchen Board within 2 seconds').toBeVisible({ timeout: LIVE });
      await expect(boardCard).toContainText(ITEM_NAME);
      await expect(boardCard, 'the option shows on the ticket').toContainText('Well done');
      await expect(boardCard).toContainText('Fresh Orange Juice');

      await staff.getByTestId('station-tab-grill').click();
      const grill = staff.getByTestId(`station-ticket-${orderNo}`);
      await expect(grill).toContainText(ITEM_NAME);
      await expect(grill).toContainText('Well done');
      await expect(grill, 'the Grill tab shows only the Grill lines').not.toContainText('Fresh Orange Juice');
      await staff.getByTestId('station-tab-bar').click();
      const bar = staff.getByTestId(`station-ticket-${orderNo}`);
      await expect(bar).toContainText('Fresh Orange Juice');
      await expect(bar, 'the Bar tab shows only the Bar lines').not.toContainText(ITEM_NAME);

      // ---------------------------------------------------------------- 3. the diner calls the waiter; the table card pulses; Respond; "Help is on the way."
      const section = staff.getByTestId(`table-section-${TABLE_ID}`);
      await staff.getByTestId('station-tab-all').click();
      await expect(section).toBeVisible();
      await expect(section).not.toHaveClass(/u7-pulse/);
      const waiter = diner.getByTestId('call-waiter');
      await waiter.click();
      await expect(waiter).toHaveText('Request sent');
      await expect(section, 'the table card says it is calling, within 2 seconds').toContainText('Calling the waiter', { timeout: LIVE });
      await expect(section).toHaveClass(/u7-pulse/);
      await staff.getByTestId(`respond-${TABLE_ID}`).click();
      await expect(section).not.toContainText('Calling the waiter', { timeout: LIVE_SLACK });
      await expect(section).not.toHaveClass(/u7-pulse/);
      await expect(diner.getByTestId('help-status'), 'the diner is told help is coming').toHaveText('Help is on the way.', { timeout: LIVE_SLACK });

      // ---------------------------------------------------------------- 4. station done: Preparing, then Completed; tracker and one ready banner
      const steps = diner.getByTestId(`order-tracker-${orderNo}`).locator('li');
      await expect(steps.nth(0)).toHaveAttribute('data-state', 'current');
      await staff.getByTestId('station-tab-grill').click();
      await staff.getByTestId(`grill-done-${orderNo}`).click();
      await expect.poll(() => orderStatus(request, orderNo), { timeout: LIVE_SLACK }).toBe('Preparing');
      await expect(steps.nth(1), 'the diner tracker moves to Preparing within 2 seconds').toHaveAttribute('data-state', 'current', { timeout: LIVE });
      await expect(diner.getByTestId('ready-banner')).toHaveCount(0);

      await staff.getByTestId('station-tab-bar').click();
      await staff.getByTestId(`bar-done-${orderNo}`).click();
      await expect.poll(() => orderStatus(request, orderNo), { timeout: LIVE_SLACK }).toBe('Completed');
      await expect(steps.nth(2), 'the diner tracker moves to Completed within 2 seconds').toHaveAttribute('data-state', 'current', { timeout: LIVE });
      const banner = diner.getByTestId('ready-banner');
      await expect(banner).toContainText(`Your order #${orderNo} is ready`, { timeout: LIVE });
      await expect(banner, 'the ready banner shows once').toHaveCount(1);

      // A reload shows no banner again: wait for the page to be live again (its presence heartbeat), then look.
      const live = diner.waitForResponse((r) => r.url().includes('/presence'));
      await diner.reload();
      await expect(diner.getByTestId('menu-screen')).toBeVisible({ timeout: 8000 });
      await live;
      await diner.getByTestId('tab-orders').click();
      await expect(diner.getByTestId(`order-card-${orderNo}`)).toBeVisible();
      await expect(diner.getByTestId(`order-status-${orderNo}`)).toContainText('Completed');
      await expect(diner.getByTestId('ready-banner'), 'no ready banner after a reload').toHaveCount(0);

      // ---------------------------------------------------------------- 5. a Chef's special, then the item is hidden: the card goes within 2 seconds
      await diner.getByTestId('tab-menu').click();
      await expect(diner.getByTestId('chef-special')).toHaveCount(0);
      await staff.goto('/staff/special');
      await expect(staff.getByTestId('special-none')).toBeVisible();
      await staff.getByLabel('Menu item').selectOption(itemId);
      await staff.getByLabel('Special price (dollars)').fill('8.00');
      await staff.getByLabel('Stock (1 to 999)').fill('5');
      await staff.getByLabel('Runs for (minutes)').fill('10');
      await staff.getByTestId('launch-special').click();
      await expect(staff.getByTestId('special-live')).toContainText(ITEM_NAME);
      const special = diner.getByTestId('chef-special');
      await expect(special, "the diner Menu shows the Chef's special within 2 seconds").toBeVisible({ timeout: LIVE });
      await expect(special).toContainText(ITEM_NAME);
      await expect(special).toContainText('$8.00');
      await expect(diner.getByTestId('special-countdown')).toContainText(/Ends in \d\d:\d\d/);

      await staff.goto('/staff/menu');
      await staff.getByTestId(`edit-${itemId}`).click();
      await staff.getByTestId('hide-item').click();
      await expect(special, 'hiding the item takes its special card off the diner Menu within 2 seconds').toHaveCount(0, { timeout: LIVE });
      await expect(card, 'and the item itself leaves the diner Menu').toHaveCount(0, { timeout: LIVE });
      await expect(staff.getByTestId(`item-row-${itemId}`)).toContainText('Hidden');
      await endSpecial(request);

      // ---------------------------------------------------------------- 6. the floor map: the order is done and the visit is open, so Eating
      await staff.goto('/staff/floor');
      await expect(staff.getByTestId('floor-table-3'), 'a table whose orders are done and whose visit is open').toContainText('Eating', { timeout: LIVE_SLACK });

      // ---------------------------------------------------------------- 7. staff open the bill (option lines), close the table; the diner rates dishes
      const before = await todaysSales(request);
      await staff.getByTestId('floor-table-3').click();
      await expect(staff.getByTestId('table-bill-screen')).toBeVisible({ timeout: 8000 });
      const billOrder = staff.getByTestId(`bill-order-${orderNo}`);
      await expect(billOrder).toBeVisible();
      await expect(billOrder, 'the bill shows the option under the item').toContainText('Well done');
      await expect(billOrder).toContainText(ITEM_NAME);
      await expect(staff.getByTestId('bill-combined-total')).toContainText(money(orderTotal));
      await expect(staff.getByTestId('btn-close-table')).toBeEnabled({ timeout: 5000 });
      await staff.getByTestId('btn-close-table').click();
      await staff.getByTestId('confirm-modal-confirm').click();
      await expect(staff.getByTestId('kitchen-board')).toBeVisible({ timeout: 8000 });

      const takeover = diner.getByTestId('table-closed-takeover');
      await expect(takeover, 'the diner sees the table closed within 2 seconds').toBeVisible({ timeout: LIVE });
      await expect(takeover).toContainText('This table was closed');
      const rate = diner.getByTestId('rate-meal');
      await expect(rate).toContainText(ITEM_NAME);
      await expect(rate).toContainText('Fresh Orange Juice');
      await diner.getByTestId(`rate-up-${itemId}`).click();
      await expect(diner.getByTestId(`rate-up-${itemId}`)).toHaveAttribute('aria-pressed', 'true');
      await diner.getByTestId('rate-down-i-11').click();
      await expect(diner.getByTestId('rate-down-i-11')).toHaveAttribute('aria-pressed', 'true');
      await diner.getByTestId('rate-done').click();
      await expect(diner.getByTestId('rate-message')).toContainText('Thank you');
      await expect(diner.getByTestId(`rate-up-${itemId}`)).toBeDisabled();

      // ---------------------------------------------------------------- 8. Past visits and sales: the closed visit, the best seller, the rated dishes
      await staff.goto('/staff/sales');
      const today = staff.getByTestId('sales-day-today');
      await expect(today).toBeVisible({ timeout: 8000 });
      await expect(today, 'one more visit and one more order than before').toContainText(`${plural(before.visits + 1, 'visit')} · ${plural(before.orders + 1, 'order')}`);
      await expect(today.getByTestId('sales-total'), "today's total grew by the closed visit's total").toHaveText(money(before.total_cents + orderTotal));
      const rows = await today.getByTestId('best-sellers').locator('tbody tr').evaluateAll((trs) => trs.map((tr) => Array.from(tr.querySelectorAll('td')).map((td) => td.textContent ?? '')));
      // Earlier specs in the same run have sold dishes too, so the new item is not always first: it must be in the
      // best sellers with exactly the quantity this visit ordered, and nothing ahead of it may have sold less.
      const bestSellers = rows.map(([label, qty]) => {
        const m = /^(\d+)\. (.*)$/.exec(label)!;
        return [label, m[1], m[2], qty];
      });
      const mine = bestSellers.find((m) => m[2] === ITEM_NAME);
      expect(mine, `the item ordered ${QTY} times is among the best sellers (rows: ${JSON.stringify(rows)})`).toBeTruthy();
      expect(Number(mine![3]), 'its quantity is what the visit ordered').toBe(QTY);
      for (const m of bestSellers.filter((b) => Number(b[1]) < Number(mine![1]))) {
        expect(Number(m[3]), `"${m[2]}" ranks above the new item, so it sold at least as many`).toBeGreaterThanOrEqual(QTY);
      }
      await expect(staff.getByTestId('ratings-best'), 'the dish rated up is among the best rated').toContainText(ITEM_NAME);
      await expect(staff.getByTestId('ratings-best')).toContainText('👍 100%');
      await expect(staff.getByTestId('ratings-worst'), 'the dish rated down is among the worst rated').toContainText('Fresh Orange Juice');
      await expect(staff.getByTestId('ratings-worst')).toContainText('thumbs down');
    } finally {
      await diner.context().close();
      // Put the added item back to hidden-and-unseen state for later specs: it is already hidden.
      await request.delete('/api/specials/current').catch(() => undefined);
    }
  });
});
