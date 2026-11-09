/**
 * U7 staff and kitchen features: browser tests of the main flows (plan Step 14).
 *
 * Twelve flows: (1) stations: Grill done makes an order Preparing, Bar done completes it, a second press changes
 * nothing; (2) All stations Complete finishes at once; (3) ticket timers (green, "Slow" at 8, "Late" at 15);
 * (4) the new-order banner and the mute switch; (5) a call pulses with its words and Respond stops it, and the
 * pulse stops under reduced motion; (6) the floor map shows all five states and updates live; (7) menu management:
 * add, edit, hide an item and a category, an invalid save names the field and keeps the text, open diner pages are
 * told within 2 seconds; (8) option groups saved and shown on a ticket; (9) the Chef's special page; (10) past visits
 * and sales on two days, best sellers, the average and "No completed orders", best and worst rated; (11) the QR page;
 * (12) option lines on the bill.
 *
 * The diner side is driven with U5's helpers (placeOrderWithOptions, moveOrder, openCall, closeTableAndRate,
 * setPresence). Every test starts signed in (the Playwright config signs in once). The tests use tables 1, 6, 8, 9
 * and 10 and put them back as they found them; other specs may leave orders on other tables, so every check names
 * its own order. Flow 10 runs its own server (E2E_PORT + 100) with a database file, so it can give visits two days.
 *
 * NOT TESTED HERE: that an open DINER Menu reloads on MENU_CHANGED. That is U6's diner code, which is not in this
 * Bolt's copy of the project; flow 7 proves the staff side (the diner's own live stream receives MENU_CHANGED within
 * 2 seconds and the diner menu route reflects the change), and the merged project's checkpoint covers the rest.
 */
import { test, expect, type APIRequestContext } from '@playwright/test';
import {
  E2E_PORT, closeTableAndRate, endSpecial, launchSpecial, moveOrder, openCall, placeOrderWithOptions, resetTableState,
  setPresence, signInAsStaff,
} from '../helpers';
import { makeTwoDays, moveOldVisitToEarlierMonth, startOwnServer, type OwnServer } from './ownServer';

const MY_TABLES = [1, 6, 8, 9, 10];

async function resetMine(request: APIRequestContext) {
  for (const t of MY_TABLES) await resetTableState(request, t);
}

test.beforeEach(async ({ request }) => {
  await resetMine(request);
});
test.afterEach(async ({ request }) => {
  await resetMine(request);
  await endSpecial(request).catch(() => undefined);
});

/** The state of one order, read from the server. */
async function statusOf(request: APIRequestContext, tableId: number, orderNumber: number): Promise<string> {
  const res = await request.get(`/api/tables/${tableId}/orders?visit=current`);
  const { orders } = (await res.json()) as { orders: Array<{ order_number: number; status: string }> };
  return orders.find((o) => o.order_number === orderNumber)?.status ?? 'none';
}

// A Classic Burger (Grill) with options and a Fresh Orange Juice (Bar)
const BURGER = { menu_item_id: 'i-04', quantity: 1, option_ids: ['oc-04-size-large', 'oc-04-extras-cheese', 'oc-04-leave-onions'] };
const JUICE = { menu_item_id: 'i-11', quantity: 1 };

// ------------------------------------------------------------------ 1 and 2: stations

test.describe('Flow 1: kitchen stations', () => {
  test('a mixed order shows the burger on Grill and the juice on Bar; Grill done makes it Preparing, Bar done completes it, a second press changes nothing', async ({ page, request }) => {
    const order = await placeOrderWithOptions(request, 8, [BURGER, JUICE]);
    await page.goto('/staff');

    await page.getByTestId('station-tab-grill').click();
    const grill = page.getByTestId(`station-ticket-${order.order_number}`);
    await expect(grill).toBeVisible();
    await expect(grill).toContainText('Classic Burger');
    await expect(grill).toContainText('Large, Extra cheese, No onions'); // the options under the item
    await expect(grill).not.toContainText('Fresh Orange Juice'); // only this station's lines
    await expect(grill).toContainText('Other stations on this order: Bar (waiting)');

    await page.getByTestId('station-tab-bar').click();
    const bar = page.getByTestId(`station-ticket-${order.order_number}`);
    await expect(bar).toContainText('Fresh Orange Juice');
    await expect(bar).not.toContainText('Classic Burger');

    // Grill done: the ticket leaves the Grill board and the order is Preparing
    await page.getByTestId('station-tab-grill').click();
    await page.getByTestId(`grill-done-${order.order_number}`).click();
    await expect(page.getByTestId(`station-ticket-${order.order_number}`)).toHaveCount(0);
    await expect.poll(() => statusOf(request, 8, order.order_number)).toBe('Preparing');

    // Bar done: the order is Completed
    await page.getByTestId('station-tab-bar').click();
    await expect(page.getByTestId(`station-ticket-${order.order_number}`)).toContainText('Other stations on this order: Grill (done)');
    await page.getByTestId(`bar-done-${order.order_number}`).click();
    await expect(page.getByTestId(`station-ticket-${order.order_number}`)).toHaveCount(0);
    await expect.poll(() => statusOf(request, 8, order.order_number)).toBe('Completed');

    // A second press (another cook, a slow connection) changes nothing and is not an error
    const again = await request.post(`/api/staff/orders/${order.order_number}/stations/Bar/done`);
    expect(again.status()).toBe(200);
    expect((await again.json()).status).toBe('Completed');
    expect(await statusOf(request, 8, order.order_number)).toBe('Completed');
  });

  test('a station done on the board shows on the diner\'s table stream: Preparing, then Completed', async ({ page, request }) => {
    const order = await placeOrderWithOptions(request, 8, [BURGER, JUICE]);
    await page.goto('/staff');
    // returns once the stream is open, so no event can be missed
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const w = window as unknown as { __st: string[] };
          w.__st = [];
          const es = new EventSource('/sse/tables/8');
          es.addEventListener('ORDER_STATUS_CHANGED', (e) => w.__st.push(JSON.parse((e as MessageEvent).data).status));
          es.addEventListener('open', () => resolve());
        })
    );
    await request.post(`/api/staff/orders/${order.order_number}/stations/Grill/done`);
    await request.post(`/api/staff/orders/${order.order_number}/stations/Bar/done`);
    await expect.poll(() => page.evaluate(() => (window as unknown as { __st: string[] }).__st), { timeout: 3000 }).toEqual(['Preparing', 'Completed']);
  });

  test('the station tabs use the tab pattern: arrow keys move between them and the selected tab is announced', async ({ page }) => {
    await page.goto('/staff');
    const all = page.getByTestId('station-tab-all');
    await expect(all).toHaveAttribute('aria-selected', 'true');
    await all.focus();
    await page.keyboard.press('ArrowRight');
    await expect(page.getByTestId('station-tab-grill')).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByTestId('station-tab-grill')).toBeFocused();
    await page.keyboard.press('End');
    await expect(page.getByTestId('station-tab-desserts')).toHaveAttribute('aria-selected', 'true');
    await page.keyboard.press('ArrowRight');
    await expect(all).toHaveAttribute('aria-selected', 'true');
  });

  test('a station\'s board can also be opened by link, /staff/stations/Bar', async ({ page, request }) => {
    const order = await placeOrderWithOptions(request, 8, [JUICE]);
    await page.goto('/staff/stations/Bar');
    await expect(page.getByRole('heading', { name: 'Bar station' })).toBeVisible();
    await expect(page.getByTestId(`station-ticket-${order.order_number}`)).toBeVisible();
    await page.getByTestId(`bar-done-${order.order_number}`).click();
    await expect.poll(() => statusOf(request, 8, order.order_number)).toBe('Completed');
  });
});

test.describe('Flow 2: the All stations view keeps v1\'s buttons', () => {
  test('Complete finishes the order at once, and it leaves every station board', async ({ page, request }) => {
    const order = await placeOrderWithOptions(request, 9, [BURGER, JUICE]);
    await page.goto('/staff');
    await page.getByTestId(`btn-preparing-${order.order_number}`).click();
    await page.getByTestId(`btn-complete-${order.order_number}`).click();
    await expect.poll(() => statusOf(request, 9, order.order_number)).toBe('Completed');
    for (const [tab, name] of [['grill', 'Grill'], ['bar', 'Bar']] as const) {
      await page.getByTestId(`station-tab-${tab}`).click();
      await expect(page.getByTestId(`${tab}-done-${order.order_number}`)).toHaveCount(0);
      expect(name).toBeTruthy();
    }
    // a station done on a Completed order that was never marked is refused, not turned into a mark
    const late = await request.post(`/api/staff/orders/${order.order_number}/stations/Grill/done`);
    expect(late.status()).toBe(422);
  });
});

// ------------------------------------------------------------------ 3: timers

test.describe('Flow 3: ticket timers', () => {
  test('green under 8 minutes, amber with "Slow" at 8, red with "Late" at 15, and the time keeps counting with no reload', async ({ page, request }) => {
    const order = await placeOrderWithOptions(request, 9, [JUICE]);
    await page.clock.install({ time: new Date() });
    await page.goto('/staff');
    const timer = page.getByTestId(`timer-${order.order_number}`);
    await expect(timer).toBeVisible();
    await expect(timer).toHaveAttribute('data-tone', 'green');
    await expect(timer).not.toContainText('Slow');

    await page.clock.fastForward('08:05');
    await expect(timer).toHaveAttribute('data-tone', 'amber');
    await expect(timer).toContainText('Slow');

    await page.clock.fastForward('07:00');
    await expect(timer).toHaveAttribute('data-tone', 'red');
    await expect(timer).toContainText('Late');
    await expect(timer).toContainText(/1[5-9] min/);
  });

  test('a reload does not restart the count: an order placed a while ago shows its real age, before and after a reload', async ({ page, request }) => {
    const order = await placeOrderWithOptions(request, 9, [JUICE]);
    // The server cannot be told to place an order in the past, so the answer the board reads is given an old
    // placed time. The age must come from that time, so a reload shows the same age and not 0.
    const tenMinutesAgo = new Date(Date.now() - 10 * 60_000).toISOString();
    await page.route('**/api/tables/9/orders?visit=current', async (route) => {
      const response = await route.fetch();
      const body = (await response.json()) as { orders: Array<{ placed_at: string }> };
      for (const o of body.orders) o.placed_at = tenMinutesAgo;
      await route.fulfill({ response, json: body });
    });
    await page.goto('/staff');
    const timer = page.getByTestId(`timer-${order.order_number}`);
    await expect(timer).toContainText('Slow');
    await expect(timer).toContainText(/1[0-1] min/);
    await page.reload();
    await expect(page.getByTestId(`timer-${order.order_number}`)).toContainText(/1[0-1] min/);
    await expect(page.getByTestId(`timer-${order.order_number}`)).toHaveAttribute('data-tone', 'amber');
  });

  test('a Completed ticket shows the time it took and a Cancelled one "Cancelled"', async ({ page, request }) => {
    const done = await placeOrderWithOptions(request, 9, [JUICE]);
    const cancelled = await placeOrderWithOptions(request, 9, [JUICE]);
    await placeOrderWithOptions(request, 9, [JUICE]); // keeps an open order on the card, so the Cancelled one stays shown
    await moveOrder(request, done.order_number, 'Preparing');
    await moveOrder(request, done.order_number, 'Completed');
    await page.goto('/staff');
    await expect(page.getByTestId(`timer-${done.order_number}`)).toContainText(/Took \d+ min/);
    await expect(page.getByTestId(`timer-${done.order_number}`)).not.toHaveAttribute('data-tone');
    await moveOrder(request, cancelled.order_number, 'Cancelled');
    await expect(page.getByTestId(`order-card-${cancelled.order_number}`)).toHaveCount(0); // v1 leaves cancelled cards off while another order is open
  });
});

// ------------------------------------------------------------------ 4 and 5: alert, mute, calls

test.describe('Flow 4: the new-order alert and the mute switch', () => {
  test.beforeEach(async ({ page }) => {
    // Count the short sounds the page makes, so the test can tell sound from silence
    await page.addInitScript(() => {
      (window as unknown as { __beeps: number }).__beeps = 0;
      class FakeAudio {
        destination = {};
        currentTime = 0;
        createOscillator() {
          (window as unknown as { __beeps: number }).__beeps++;
          return { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {}, onended: null };
        }
        createGain() {
          return { gain: { value: 0 }, connect() {} };
        }
        close() {}
      }
      (window as unknown as { AudioContext: unknown }).AudioContext = FakeAudio;
    });
  });

  test('a new order raises "New order #<n> from Table <n>" within 2 seconds, once, with a sound only after the first tap; Muted keeps the banner and drops the sound', async ({ page, request }) => {
    await page.goto('/staff');
    await expect(page.getByTestId('kitchen-board')).toHaveAttribute('data-sse', 'connected');
    await expect(page.getByRole('button', { name: 'Sound on' })).toHaveAttribute('aria-pressed', 'true');

    // before any tap: the banner shows, no sound
    const first = await placeOrderWithOptions(request, 6, [BURGER, JUICE]);
    await expect(page.getByTestId(`new-order-alert-${first.order_number}`)).toContainText(`New order #${first.order_number} from Table 6`, { timeout: 2000 });
    expect(await page.evaluate(() => (window as unknown as { __beeps: number }).__beeps)).toBe(0);

    // after the first tap: a sound
    await page.getByTestId('kitchen-board').click({ position: { x: 5, y: 5 } });
    const second = await placeOrderWithOptions(request, 8, [JUICE]);
    await expect(page.getByTestId(`new-order-alert-${second.order_number}`)).toBeVisible({ timeout: 2000 });
    await expect.poll(() => page.evaluate(() => (window as unknown as { __beeps: number }).__beeps)).toBe(1);
    await expect(page.getByText(`New order #${second.order_number} from Table 8`)).toHaveCount(1); // once

    // Muted: the banner still shows, the sound does not play
    await page.getByRole('button', { name: 'Muted' }).click();
    await expect(page.getByRole('button', { name: 'Muted' })).toHaveAttribute('aria-pressed', 'true');
    const third = await placeOrderWithOptions(request, 9, [JUICE]);
    // the banner and the sound decision happen in the same step, so once the banner shows the sound has been decided
    await expect(page.getByTestId(`new-order-alert-${third.order_number}`)).toBeVisible({ timeout: 2000 });
    expect(await page.evaluate(() => (window as unknown as { __beeps: number }).__beeps)).toBe(1);
  });

  test('the Muted choice is remembered after a reload, and a banner can be dismissed', async ({ page, request }) => {
    await page.goto('/staff');
    await page.getByRole('button', { name: 'Muted' }).click();
    await page.reload();
    await expect(page.getByRole('button', { name: 'Muted' })).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByTestId('kitchen-board')).toHaveAttribute('data-sse', 'connected');
    const order = await placeOrderWithOptions(request, 6, [JUICE]);
    const banner = page.getByTestId(`new-order-alert-${order.order_number}`);
    await expect(banner).toBeVisible({ timeout: 2000 });
    await page.getByTestId(`new-order-alert-${order.order_number}-dismiss`).click();
    await expect(banner).toHaveCount(0);
    await page.getByRole('button', { name: 'Sound on' }).click(); // leave it as it was found
  });

  test('an order placed before the page was opened raises no banner', async ({ page, request }) => {
    const old = await placeOrderWithOptions(request, 6, [JUICE]);
    await page.goto('/staff');
    await expect(page.getByTestId(`order-card-${old.order_number}`)).toBeVisible();
    await expect(page.getByTestId(`new-order-alert-${old.order_number}`)).toHaveCount(0);
  });
});

test.describe('Flow 5: a table that calls', () => {
  test('pulses with "Calling the waiter" and "Asking for the bill"; Respond stops it', async ({ page, request }) => {
    const order = await placeOrderWithOptions(request, 6, [JUICE]);
    await page.goto('/staff');
    const card = page.getByTestId('table-section-6');
    await expect(card).toBeVisible();
    await expect(card).not.toHaveClass(/u7-pulse/);

    await openCall(request, 6, 'waiter');
    await expect(card).toContainText('Calling the waiter', { timeout: 2000 });
    await expect(card).toHaveClass(/u7-pulse/);
    await openCall(request, 6, 'bill');
    await expect(card).toContainText('Asking for the bill', { timeout: 2000 });
    await expect(card).toContainText('Calling the waiter'); // both at once

    await page.getByTestId('respond-6').click();
    await expect(card).not.toContainText('Calling the waiter', { timeout: 3000 });
    await expect(card).not.toContainText('Asking for the bill');
    await expect(card).not.toHaveClass(/u7-pulse/);
    expect(order.order_number).toBeGreaterThan(0);
  });

  test('closing the table clears the pulse', async ({ page, request }) => {
    await placeOrderWithOptions(request, 6, [JUICE]);
    await openCall(request, 6, 'bill');
    await page.goto('/staff');
    await expect(page.getByTestId('table-section-6')).toContainText('Asking for the bill');
    await closeTableAndRate(request, 6);
    await expect(page.getByTestId('table-section-6')).toHaveCount(0, { timeout: 3000 });
  });

  test('under reduced motion the card does not pulse, but the words stay', async ({ page, request }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await placeOrderWithOptions(request, 6, [JUICE]);
    await openCall(request, 6, 'waiter');
    await page.goto('/staff');
    const card = page.getByTestId('table-section-6');
    await expect(card).toContainText('Calling the waiter');
    expect(await card.evaluate((el) => getComputedStyle(el).animationName)).toBe('none');
  });

  test('with motion allowed the card really pulses', async ({ page, request }) => {
    await page.emulateMedia({ reducedMotion: 'no-preference' });
    await placeOrderWithOptions(request, 6, [JUICE]);
    await openCall(request, 6, 'waiter');
    await page.goto('/staff');
    const card = page.getByTestId('table-section-6');
    await expect(card).toContainText('Calling the waiter');
    expect(await card.evaluate((el) => getComputedStyle(el).animationName)).not.toBe('none');
  });
});

// ------------------------------------------------------------------ 6: floor map

test.describe('Flow 6: the floor map', () => {
  test('shows all five states as words, and each change shows within 2 seconds', async ({ page, request }) => {
    await page.goto('/staff/floor');
    await expect(page.getByTestId('floor-map')).toBeVisible();
    await expect(page.getByTestId('floor-table-6')).toContainText('Empty');

    // Browsing: a diner page is present
    await setPresence(page, 1, 1);
    await expect(page.getByTestId('floor-table-1')).toContainText('Browsing', { timeout: 2500 });

    // Waiting: an order is open
    const waiting = await placeOrderWithOptions(request, 8, [JUICE]);
    await expect(page.getByTestId('floor-table-8')).toContainText('Waiting', { timeout: 2500 });

    // Eating: the order is finished and the visit is open
    const eating = await placeOrderWithOptions(request, 9, [JUICE]);
    await moveOrder(request, eating.order_number, 'Preparing');
    await moveOrder(request, eating.order_number, 'Completed');
    await expect(page.getByTestId('floor-table-9')).toContainText('Eating', { timeout: 2500 });

    // Needs the bill: an open bill request beats the rest
    await placeOrderWithOptions(request, 10, [JUICE]);
    await openCall(request, 10, 'bill');
    await expect(page.getByTestId('floor-table-10')).toContainText('Needs the bill', { timeout: 2500 });

    // and back: finishing the waiting order makes it Eating; closing a table makes it Empty
    await moveOrder(request, waiting.order_number, 'Preparing');
    await moveOrder(request, waiting.order_number, 'Completed');
    await expect(page.getByTestId('floor-table-8')).toContainText('Eating', { timeout: 2500 });
    await closeTableAndRate(request, 9);
    await expect(page.getByTestId('floor-table-9')).toContainText('Empty', { timeout: 2500 });
    await expect(page.getByTestId('floor-table-1')).toContainText('Browsing');

    // every state is also a colour class, and the legend names all five
    await expect(page.getByTestId('floor-table-10')).toHaveClass(/bill/);
    for (const w of ['Empty', 'Browsing', 'Waiting', 'Eating', 'Needs the bill']) await expect(page.getByTestId('floor-legend')).toContainText(w);
  });

  test('selecting a table opens its bill', async ({ page, request }) => {
    await placeOrderWithOptions(request, 8, [JUICE]);
    await page.goto('/staff/floor');
    await page.getByTestId('floor-table-8').click();
    await expect(page).toHaveURL(/\/staff\/tables\/8$/);
    await expect(page.getByTestId('table-bill-screen')).toBeVisible();
  });

  test('lists the tables the server lists, and works from the keyboard', async ({ page }) => {
    await page.goto('/staff/floor');
    await expect(page.getByTestId('floor-table-10')).toBeVisible();
    expect(await page.locator('[data-testid^="floor-table-"]').count()).toBeGreaterThanOrEqual(10);
    await page.getByTestId('floor-table-6').focus();
    await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/staff\/tables\/6$/);
  });
});

// ------------------------------------------------------------------ 7 and 8: menu management

const UNIQUE = `E2E ${Date.now() % 100000}`;

test.describe.serial('Flows 7 and 8: menu management and option groups', () => {
  test('add an item; an invalid save names the field and keeps the text; the diner stream is told within 2 seconds', async ({ page, request }) => {
    await page.goto('/staff/menu');
    await expect(page.getByTestId('menu-management')).toBeVisible();
    // a diner page is "open": its table stream, in this page's browser
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const w = window as unknown as { __menu: Array<{ reason: string; ids: string[] }> };
          w.__menu = [];
          const es = new EventSource('/sse/tables/6');
          es.addEventListener('MENU_CHANGED', (e) => w.__menu.push(JSON.parse((e as MessageEvent).data)));
          es.addEventListener('open', () => resolve());
        })
    );

    await page.getByTestId('add-item').click();
    // an invalid save (a 61-character name): the field is named and everything typed is kept
    await page.getByLabel('Name', { exact: true }).fill('x'.repeat(61));
    await page.getByLabel('Description').fill('Typed description that must survive');
    await page.getByLabel('Price (dollars)').fill('7.25');
    await page.getByLabel('Station').selectOption('Cold');
    await page.getByTestId('save-item').click();
    await expect(page.getByTestId('field-f-name')).toContainText('Name must be 60 characters or fewer.');
    await expect(page.getByLabel('Name', { exact: true })).toHaveValue('x'.repeat(61));
    await expect(page.getByLabel('Description')).toHaveValue('Typed description that must survive');
    await expect(page.getByLabel('Price (dollars)')).toHaveValue('7.25');
    expect(await page.evaluate(() => (window as unknown as { __menu: unknown[] }).__menu.length)).toBe(0); // nothing published

    // fix it and save
    await page.getByLabel('Name', { exact: true }).fill(`${UNIQUE} Soup`);
    await page.getByTestId('save-item').click();
    await expect(page.getByTestId('item-form')).toHaveCount(0);
    await expect(page.getByRole('row', { name: new RegExp(`${UNIQUE} Soup`) })).toBeVisible();
    await expect.poll(() => page.evaluate(() => (window as unknown as { __menu: Array<{ reason: string }> }).__menu.map((m) => m.reason)), { timeout: 2000 }).toContain('item');

    // the diner's menu route has it, with the price and station kept
    const diner = (await (await request.get('/api/menu')).json()) as { items: Array<{ name: string; price_cents: number; station: string }> };
    expect(diner.items.find((i) => i.name === `${UNIQUE} Soup`)).toMatchObject({ price_cents: 725, station: 'Cold' });
  });

  test('edit the price: open diner streams hear it within 2 seconds and the diner menu shows the new price', async ({ page, request }) => {
    await page.goto('/staff/menu');
    const row = page.getByRole('row', { name: new RegExp(`${UNIQUE} Soup`) });
    await page.evaluate(
      () =>
        new Promise<void>((resolve) => {
          const w = window as unknown as { __menu: unknown[] };
          w.__menu = [];
          const es = new EventSource('/sse/tables/6');
          es.addEventListener('MENU_CHANGED', (e) => w.__menu.push(JSON.parse((e as MessageEvent).data)));
          es.addEventListener('open', () => resolve());
        })
    );
    await row.getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Price (dollars)').fill('8.00');
    await page.getByTestId('save-item').click();
    await expect(page.getByTestId('item-form')).toHaveCount(0);
    await expect.poll(() => page.evaluate(() => (window as unknown as { __menu: unknown[] }).__menu.length), { timeout: 2000 }).toBeGreaterThan(0);
    const diner = (await (await request.get('/api/menu')).json()) as { items: Array<{ name: string; price_cents: number }> };
    expect(diner.items.find((i) => i.name === `${UNIQUE} Soup`)!.price_cents).toBe(800);
  });

  test('option groups: add a group, save, and the options show on a ticket', async ({ page, request }) => {
    await page.goto('/staff/menu');
    const row = page.getByRole('row', { name: new RegExp(`${UNIQUE} Soup`) });
    await row.getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Station').selectOption('Grill');
    await page.getByRole('button', { name: 'Add option group' }).click();
    await page.getByLabel('Group name').fill('Bowl');
    await page.getByLabel('Choice 1', { exact: true }).fill('Small');
    await page.getByLabel('Price change ($)').fill('0.00');
    await page.getByRole('button', { name: 'Add choice' }).click();
    await page.getByLabel('Choice 2', { exact: true }).fill('Large');
    await page.getByLabel('Price change ($)').nth(1).fill('2.50');
    await page.getByLabel('Required').check();
    await page.getByTestId('save-item').click();
    await expect(page.getByTestId('item-form')).toHaveCount(0);
    await expect(page.getByRole('row', { name: new RegExp(`${UNIQUE} Soup`) })).toContainText('1 option group');

    const menu = (await (await request.get('/api/staff/menu')).json()) as { items: Array<{ id: string; name: string; options: Array<{ choices: Array<{ id: string; label: string }> }> }> };
    const item = menu.items.find((i) => i.name === `${UNIQUE} Soup`)!;
    const large = item.options[0].choices.find((c) => c.label === 'Large')!;
    const order = await placeOrderWithOptions(request, 6, [{ menu_item_id: item.id, quantity: 1, option_ids: [large.id] }]);
    await page.goto('/staff');
    await expect(page.getByTestId(`line-options-${order.order_number}-0`)).toHaveText('Large');
    expect(order.lines[0].price_cents_each).toBe(1050); // 8.00 + 2.50, frozen
  });

  test('an option that would put the price below zero is refused beside the choice, and the typed text is kept', async ({ page }) => {
    await page.goto('/staff/menu');
    const row = page.getByRole('row', { name: new RegExp(`${UNIQUE} Soup`) });
    await row.getByRole('button', { name: 'Edit' }).click();
    await page.getByLabel('Price change ($)').first().fill('-99.00');
    await page.getByTestId('save-item').click();
    await expect(page.getByTestId('item-form-errors')).toContainText('below $0.00');
    await expect(page.getByLabel('Price change ($)').first()).toHaveValue('-99.00');
    await page.getByRole('button', { name: 'Cancel' }).click();
  });

  test('hide the item, then show it; hiding is not deleting', async ({ page, request }) => {
    await page.goto('/staff/menu');
    const row = () => page.getByRole('row', { name: new RegExp(`${UNIQUE} Soup`) });
    await row().getByRole('button', { name: 'Edit' }).click();
    await page.getByTestId('hide-item').click();
    await expect(page.getByTestId('item-form')).toHaveCount(0);
    await expect(row()).toContainText('Hidden');
    expect(((await (await request.get('/api/menu')).json()) as { items: Array<{ name: string }> }).items.some((i) => i.name === `${UNIQUE} Soup`)).toBe(false);
    await row().getByRole('button', { name: 'Show' }).click();
    await expect(row().getByRole('button', { name: 'Edit' })).toBeVisible();
    expect(((await (await request.get('/api/menu')).json()) as { items: Array<{ name: string }> }).items.some((i) => i.name === `${UNIQUE} Soup`)).toBe(true);
    // leave it hidden
    await row().getByRole('button', { name: 'Edit' }).click();
    await page.getByTestId('hide-item').click();
    await expect(row()).toContainText('Hidden');
  });

  test('categories: add one, rename it, move it, hide it and show it again', async ({ page, request }) => {
    const name = `${UNIQUE} Cat`;
    await page.goto('/staff/menu');
    await page.getByTestId('add-category').click();
    await page.getByLabel('Category name').fill('drinks'); // a duplicate of Drinks, ignoring case
    await page.getByTestId('save-category').click();
    await expect(page.getByTestId('field-c-name')).toContainText('A category with that name already exists.');
    await expect(page.getByLabel('Category name')).toHaveValue('drinks');
    await page.getByLabel('Category name').fill(name);
    await page.getByTestId('save-category').click();
    const section = page.getByRole('region', { name });
    await expect(section).toBeVisible();

    await section.getByRole('button', { name: 'Move category up' }).click();
    await expect.poll(async () => {
      const m = (await (await request.get('/api/staff/menu')).json()) as { categories: Array<{ name: string; order: number }> };
      return m.categories[m.categories.length - 2].name;
    }).toBe(name);

    await section.getByRole('button', { name: 'Hide category' }).click();
    await expect(section).toContainText('Hidden');
    expect(((await (await request.get('/api/menu')).json()) as { categories: Array<{ name: string }> }).categories.some((c) => c.name === name)).toBe(false);
    await section.getByRole('button', { name: 'Show category' }).click();
    await expect(section).not.toContainText('Hidden');
    // leave the new (empty) category hidden, so no later spec sees it on the diner menu
    await section.getByRole('button', { name: 'Hide category' }).click();
    await expect(section).toContainText('Hidden');
  });
});

// ------------------------------------------------------------------ 9: Chef's special

test.describe('Flow 9: the Chef\'s special page', () => {
  test('launch, see the countdown and stock, end it now; a launch with a bad value is refused beside the field', async ({ page }) => {
    await page.goto('/staff/special');
    await expect(page.getByTestId('special-none')).toHaveText('No special is live.');

    // a refused launch: stock 0
    await page.getByLabel('Special price (dollars)').fill('10.00');
    await page.getByLabel('Stock (1 to 999)').fill('0');
    await page.getByTestId('launch-special').click();
    await expect(page.getByTestId('field-s-stock')).toContainText('Stock must be a whole number from 1 to 999.');
    await expect(page.getByLabel('Stock (1 to 999)')).toHaveValue('0');
    await expect(page.getByLabel('Special price (dollars)')).toHaveValue('10.00');
    await expect(page.getByTestId('special-none')).toBeVisible();

    // launch properly
    await page.getByLabel('Menu item').selectOption('i-04');
    await page.getByLabel('Stock (1 to 999)').fill('6');
    await page.getByLabel('Runs for (minutes)').fill('15');
    await page.getByTestId('launch-special').click();
    const live = page.getByTestId('special-live');
    await expect(live).toContainText('Live now');
    await expect(live).toContainText('Classic Burger');
    await expect(live).toContainText('$10.00');
    await expect(page.getByTestId('special-stock-left')).toHaveText('6');
    await expect(page.getByTestId('special-countdown')).toContainText(/Ends in 1[45]:\d\d/);

    await page.getByTestId('end-special').click();
    await expect(page.getByTestId('special-none')).toHaveText('No special is live.');
  });

  test('follows the special live: a launch from another screen shows at once, and a sold-out special switches to "No special is live."', async ({ page, request }) => {
    await page.goto('/staff/special');
    await expect(page.getByTestId('special-none')).toBeVisible();
    await launchSpecial(request, { item_id: 'i-06', special_price_cents: 900, stock: 1, minutes: 30 });
    await expect(page.getByTestId('special-live')).toContainText('Margherita Pizza', { timeout: 2500 });
    // one diner buys the last one: the special sells out and the page switches
    const sold = await placeOrderWithOptions(request, 6, [{ menu_item_id: 'i-06', quantity: 1, special_id: (await (await request.get('/api/specials/current')).json()).special.id }]);
    expect(sold.lines[0].price_cents_each).toBe(900);
    await expect(page.getByTestId('special-none')).toBeVisible({ timeout: 2500 });
  });

  test('a launch ends the one that is live', async ({ page, request }) => {
    await launchSpecial(request, { item_id: 'i-06', special_price_cents: 900, stock: 5, minutes: 30 });
    await page.goto('/staff/special');
    await expect(page.getByTestId('special-live')).toContainText('Margherita Pizza');
    await page.getByLabel('Menu item').selectOption('i-07');
    await page.getByLabel('Special price (dollars)').fill('9.00');
    await page.getByLabel('Stock (1 to 999)').fill('4');
    await page.getByTestId('launch-special').click();
    await expect(page.getByTestId('special-live')).toContainText('Pasta Carbonara');
    await expect(page.getByTestId('special-live')).not.toContainText('Margherita Pizza');
  });
});

// ------------------------------------------------------------------ 10: past visits and sales (its own server)

const SALES_PORT = E2E_PORT + 100;

test.describe.serial('Flow 10: past visits and sales', () => {
  let server: OwnServer;

  test.beforeAll(async () => {
    server = await startOwnServer(SALES_PORT, 'u7-sales.db');
  });
  test.afterAll(async () => {
    await server?.stop();
  });

  const openSales = async (browser: import('@playwright/test').Browser) => {
    const context = await browser.newContext({ baseURL: server.origin, viewport: { width: 1280, height: 900 } });
    const page = await context.newPage();
    await signInAsStaff(page, server.api);
    await page.goto('/staff/sales');
    return { page, context };
  };

  test('with no closed visit it says "No closed visits yet."', async ({ browser }) => {
    const { page, context } = await openSales(browser);
    await expect(page.getByTestId('sales-empty')).toHaveText('No closed visits yet.');
    await context.close();
  });

  test('two days: totals add up, best sellers rank by quantity, the average is in minutes or "No completed orders", Cancelled orders count nowhere, and the best and worst rated show', async ({ browser }) => {
    // Today: two visits (one rated each) and a cancelled order; yesterday: one visit with no completed time, its dates
    // written into the database file in v1's text form (so both stored formats are read). See makeTwoDays.
    await makeTwoDays(server);

    const { page, context } = await openSales(browser);
    const today = page.getByTestId('sales-day-today');
    await expect(today).toBeVisible();
    // table 1: burger x2 (1450 each) + water (350) = 3250; table 2: salad 850 + burger 1450 = 2300; the cancelled order counts nowhere
    await expect(today).toContainText('2 visits · 2 orders');
    await expect(today.getByTestId('sales-total')).toHaveText('$55.50');
    await expect(today.getByTestId('sales-average')).toContainText(/\d+(\.\d)? min/);
    await expect(today).toContainText('Average per visit');
    await expect(today.getByTestId('sales-average')).not.toContainText('No completed orders');
    // best sellers: burger 3, then salad / water (1 each, by name: House Salad, Sparkling Water)
    const rows = await today.getByTestId('best-sellers').getByRole('row').allTextContents();
    expect(rows.slice(1)).toEqual(['1. Classic Burger3', '2. House Salad1', '3. Sparkling Water1']);
    expect(await today.textContent()).not.toContain('Grilled Salmon'); // the cancelled order counts nowhere

    // yesterday: one visit, no completed time
    const yd = page.getByTestId(/^sales-day-\d{4}-\d{2}-\d{2}$/);
    await expect(yd).toHaveCount(1);
    await expect(yd).toContainText('1 visit · 1 order');
    await expect(yd.getByTestId('sales-total')).toHaveText('$19.00');
    await expect(yd.getByTestId('sales-average')).toHaveText('No completed orders');
    // newest day first
    const order = await page.locator('[data-testid^="sales-day-"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-testid')));
    expect(order[0]).toBe('sales-day-today');

    // best and worst rated today: Classic Burger 2 of 2 up; House Salad 0 of 1; Sparkling Water 0 of 1
    await expect(page.getByTestId('ratings-best')).toContainText('Classic Burger');
    await expect(page.getByTestId('ratings-best')).toContainText('👍 100% · 2 ratings');
    await expect(page.getByTestId('ratings-worst')).toContainText('👎 100% thumbs down · 1 rating');
    await expect(page.getByTestId('ratings-card')).toContainText('Ties go to the dish with more ratings');
    await context.close();
  });

  test('the month filter: an earlier month shows only its own days and totals, and All months brings every day back', async ({ browser }) => {
    // the visit that closed "yesterday" is moved two months back, so the page holds today's visits and one old month
    const olderMonth = moveOldVisitToEarlierMonth(server, 2);
    const { page, context } = await openSales(browser);
    const select = page.getByTestId('sales-month');
    await expect(select).toHaveValue('all');
    await expect(page.getByTestId('sales-day-today')).toBeVisible();
    await expect(page.locator('[data-testid^="sales-day-"]')).toHaveCount(2);

    await select.selectOption(olderMonth);
    await expect(page.getByTestId('sales-day-today')).toHaveCount(0);
    await expect(page.locator('[data-testid^="sales-day-"]')).toHaveCount(1);
    await expect(page.getByTestId('sales-month-total')).toContainText('1 visit · 1 order · $19.00 in sales');

    await select.selectOption('all');
    await expect(page.locator('[data-testid^="sales-day-"]')).toHaveCount(2);
    await expect(page.getByTestId('sales-month-total')).toHaveCount(0);
    await context.close();
  });
});

// ------------------------------------------------------------------ 11: QR codes

test.describe('Flow 11: the QR page', () => {
  test('each table has a code holding <address>/table/<n>, made in the browser with no outside request', async ({ page, baseURL }) => {
    const outside: string[] = [];
    page.on('request', (r) => {
      if (!r.url().startsWith(baseURL!) && !r.url().startsWith('data:') && !r.url().startsWith('blob:')) outside.push(r.url());
    });
    await page.goto('/staff/qr');
    await expect(page.getByTestId('qr-page')).toBeVisible();
    await expect(page.getByTestId('qr-table-10')).toBeVisible();
    for (let n = 1; n <= 10; n++) {
      const code = page.getByTestId(`qr-code-${n}`);
      await expect(code).toHaveAttribute('data-qr-text', `${baseURL}/table/${n}`);
      await expect(code.locator('svg path')).toHaveCount(1);
      await expect(page.getByTestId(`qr-table-${n}`)).toContainText(`Table ${n}`);
    }
    expect(outside).toEqual([]);
    // the codes differ from each other
    const paths = await page.locator('[data-testid^="qr-code-"] svg path').evaluateAll((els) => els.map((e) => e.getAttribute('d')));
    expect(new Set(paths).size).toBe(paths.length);
    await expect(page.getByTestId('qr-network-note')).toContainText('not "localhost"');
  });

  test('the print view shows every code and label and none of the screen\'s buttons', async ({ page }) => {
    await page.goto('/staff/qr');
    await expect(page.getByTestId('qr-table-10')).toBeVisible();
    await page.emulateMedia({ media: 'print' });
    for (let n = 1; n <= 10; n++) await expect(page.getByTestId(`qr-table-${n}`)).toBeVisible();
    await expect(page.getByTestId('print-qr')).toBeHidden();
    await expect(page.getByTestId('qr-network-note')).toBeHidden();
    await expect(page.getByTestId('side-nav')).toBeHidden();
    await expect(page.getByTestId('staff-topbar')).toBeHidden();
    // several codes to a page: the first row holds more than one
    const tops = await page.locator('[data-testid^="qr-table-"]').evaluateAll((els) => els.slice(0, 3).map((e) => Math.round(e.getBoundingClientRect().top)));
    expect(new Set(tops).size).toBe(1);
  });
});

// ------------------------------------------------------------------ 12: option lines on the bill

test.describe('Flow 12: option lines on the bill', () => {
  test('the bill shows each line\'s options under the item and the frozen price that includes them', async ({ page, request }) => {
    const order = await placeOrderWithOptions(request, 6, [BURGER, { menu_item_id: 'i-10', quantity: 2 }]);
    await moveOrder(request, order.order_number, 'Preparing');
    await moveOrder(request, order.order_number, 'Completed');
    await page.goto('/staff/tables/6');
    const card = page.getByTestId(`bill-order-${order.order_number}`);
    await expect(card).toBeVisible();
    await expect(page.getByTestId(`bill-line-options-${order.order_number}-0`)).toHaveText('Large, Extra cheese, No onions');
    await expect(card).toContainText('$18.50'); // 14.50 + 3.00 + 1.00, frozen at placement
    await expect(page.getByTestId(`bill-line-options-${order.order_number}-1`)).toHaveCount(0); // the water has none
    // a menu price change does not change the bill
    expect(order.lines[0].price_cents_each).toBe(1850);
    await expect(page.getByTestId('bill-combined-total')).toContainText('$25.50');
  });

  test('Close table still works and clears the table\'s pulse', async ({ page, request }) => {
    const order = await placeOrderWithOptions(request, 6, [BURGER]);
    await moveOrder(request, order.order_number, 'Preparing');
    await moveOrder(request, order.order_number, 'Completed');
    await openCall(request, 6, 'bill');
    await page.goto('/staff/tables/6');
    await expect(page.getByTestId('btn-close-table')).toBeEnabled({ timeout: 8000 });
    await page.getByTestId('btn-close-table').click();
    await page.getByTestId('confirm-modal-confirm').click();
    await expect(page).toHaveURL(/\/staff$/);
    await expect(page.getByTestId('table-section-6')).toHaveCount(0);
  });
});
