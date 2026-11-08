/**
 * U6 diner features: browser tests of the main flows (plan Step 10; BR1.x to BR9.x).
 *
 * Twelve flows, the staff side driven with U5's helpers (e2e/helpers): (1) choose options with a price change,
 * add, place, see the options on My orders; (2) a required group blocks Add and names the group; (3) allergy
 * chips from Settings mark an item and the warning blocks Place order until confirmed; (4) the estimate in the
 * Cart and "Running late"; (5) the tracker follows an order through its statuses, with no animation under
 * reduced motion; (6) the ready banner shows once and not after a reload; (7) "Same again"; (8) the call
 * buttons and "Help is on the way."; (9) a launched special shows its card, can be ordered and goes when it
 * ends; (10) after Close table the thumbs show, change until Done and are locked after; (11) a live menu
 * change reaches an open Menu and the cart notice names it; (12) Settings saves allergies, theme and sound
 * across a reload.
 *
 * Every test starts on a fresh browser context (an empty cart). Table 5 is used and put back as found; the
 * Chef's special and a sold-out switch are put back too.
 */
import { test, expect, type Page } from '@playwright/test';
import {
  changeMenuDirectly, closeTableAndRate, endSpecial, launchSpecial, moveOrder, placeOrderWithOptions, resetTableState,
} from '../helpers';

const TABLE = 5;

async function openTable(page: Page, tab: 'menu' | 'cart' | 'orders' = 'menu') {
  await page.goto(`/table/${TABLE}`);
  await expect(page.getByTestId('menu-screen')).toBeVisible();
  if (tab !== 'menu') await page.getByTestId(`tab-${tab}`).click();
}

async function placeFromCart(page: Page) {
  await page.getByTestId('tab-cart').click();
  await page.getByTestId('place-order-button').click();
  await page.getByTestId('confirm-modal-confirm').click();
}

test.beforeEach(async ({ request }) => {
  await resetTableState(request, TABLE);
  await endSpecial(request);
});
test.afterEach(async ({ request }) => {
  await endSpecial(request);
  await changeMenuDirectly(request, 'i-02', { available: true });
  await resetTableState(request, TABLE);
});

test('1. options with a price change: choose, add, place, and the options show on My orders', async ({ page }) => {
  await openTable(page);
  await expect(page.getByTestId('make-it-yours-i-04')).toBeVisible();
  await page.getByTestId('add-item-i-04').click();
  await expect(page.getByTestId('options-sheet')).toBeVisible();
  await page.getByTestId('option-choice-oc-04-size-large').click();
  await page.getByTestId('option-choice-oc-04-extras-cheese').click();
  await page.getByTestId('option-choice-oc-04-leave-onions').click();
  await expect(page.getByTestId('options-price')).toHaveText('$18.50'); // 14.50 + 3.00 + 1.00 + 0.00
  await page.getByTestId('options-add').click();
  await expect(page.getByTestId('options-sheet')).toHaveCount(0);

  await page.getByTestId('tab-cart').click();
  await expect(page.getByTestId('cart-total')).toHaveText('$18.50');
  const options = page.locator('[data-testid^="cart-options-"]');
  await expect(options).toContainText('Large');
  await expect(options).toContainText('Extra cheese');
  await expect(options).toContainText('No onions');
  await page.getByTestId('place-order-button').click();
  await page.getByTestId('confirm-modal-confirm').click();

  await expect(page.getByTestId('order-success-banner')).toBeVisible();
  await expect(page.locator('[data-testid^="order-line-options-"]').first()).toHaveText('Large, Extra cheese, No onions');
  // the server charged the price with the options
  const orders = (await (await page.request.get(`/api/tables/${TABLE}/orders?visit=current`)).json()) as { orders: Array<{ lines: Array<{ price_cents_each: number }> }> };
  expect(orders.orders[0].lines[0].price_cents_each).toBe(1850);
});

test('1b. the same item with the same choices joins one line; other choices make a second line', async ({ page }) => {
  await openTable(page);
  for (const choice of ['oc-04-size-large', 'oc-04-size-large', 'oc-04-size-regular']) {
    await page.getByTestId('add-item-i-04').click();
    await page.getByTestId(`option-choice-${choice}`).click();
    await page.getByTestId('options-add').click();
  }
  await page.getByTestId('tab-cart').click();
  await expect(page.locator('[data-testid^="cart-item-i-04#"]')).toHaveCount(2);
  await expect(page.getByTestId('cart-qty-i-04#oc-04-size-large')).toHaveText('2');
});

test('2. a required group blocks Add to cart and names the group', async ({ page }) => {
  // The seed's Size group is not required (U5 deviation); the menu answer is changed here so the sheet meets a required one.
  await page.route('**/api/menu', async (route) => {
    const res = await route.fetch();
    const body = (await res.json()) as { items: Array<{ id: string; options: Array<{ name: string; required: boolean }> }> };
    for (const item of body.items) for (const g of item.options ?? []) if (g.name === 'Size') g.required = true;
    await route.fulfill({ response: res, json: body });
  });
  await openTable(page);
  await page.getByTestId('add-item-i-04').click();
  await expect(page.getByText('Required').first()).toBeVisible();
  await expect(page.getByTestId('options-add')).toBeDisabled();
  await expect(page.getByTestId('options-missing')).toHaveText('Choose a size');
  await page.getByTestId('option-choice-oc-04-size-regular').click();
  await expect(page.getByTestId('options-add')).toBeEnabled();
  await expect(page.getByTestId('options-missing')).toHaveCount(0);
});

test('3. allergy chips mark the menu, and the warning blocks Place order until "Place order anyway"', async ({ page }) => {
  await openTable(page);
  await page.getByTestId('open-settings').click();
  await page.getByTestId('allergy-chip-dairy').click();
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('settings-sheet')).toHaveCount(0);

  // the Menu behind updated at once
  await expect(page.getByTestId('menu-item-i-01').getByTestId('allergen-mark')).toHaveText(/Contains dairy/);
  await expect(page.getByTestId('menu-item-i-05').getByTestId('allergens-not-set')).toBeVisible(); // Grilled Salmon: not set
  await expect(page.getByTestId('menu-item-i-02').getByTestId('allergen-mark')).toHaveCount(0); // House Salad: none

  await page.getByTestId('add-item-i-01').click();
  await page.getByTestId('tab-cart').click();
  await page.getByTestId('place-order-button').click();
  const warning = page.getByTestId('allergy-warning');
  await expect(warning).toContainText('Garlic Bread');
  await expect(warning).toContainText('guidance, not a promise');
  // nothing has been ordered yet
  expect(((await (await page.request.get(`/api/tables/${TABLE}/orders?visit=current`)).json()) as { orders: unknown[] }).orders).toHaveLength(0);
  await page.getByTestId('allergy-confirm').click();
  await expect(page.getByTestId('order-success-banner')).toBeVisible();
});

test('4. the Cart shows an estimate labelled as one, and an overdue order says "Running late"', async ({ page }) => {
  await openTable(page);
  await page.getByTestId('add-item-i-02').click();
  await page.getByTestId('tab-cart').click();
  const estimate = page.getByTestId('wait-estimate');
  await expect(estimate).toContainText(/Estimated wait: about \d+ min/);
  await expect(estimate).toContainText('Estimate, based on');
  await expect(estimate).not.toContainText('about 0 min');
  await placeFromCart(page);

  // The same order seen 40 minutes later (the server's answer is moved back in time for this page only).
  const ORDERS = new RegExp(`/api/tables/${TABLE}/orders\\?visit=current`);
  await page.route(ORDERS, async (route) => {
    try {
      const res = await page.request.get(route.request().url());
      const body = (await res.json()) as { orders: Array<{ placed_at: string; estimate_minutes: number }> };
      for (const o of body.orders) o.placed_at = new Date(Date.now() - 40 * 60_000).toISOString();
      await route.fulfill({ json: body });
    } catch {
      // the page was already closing when a late request came in: nothing to answer
    }
  });
  await page.getByTestId('tab-menu').click();
  await page.getByTestId('tab-orders').click();
  await expect(page.locator('[data-testid^="running-late-"]')).toHaveText('Running late');
  await expect(page.locator('[data-testid^="order-estimate-"]')).toHaveCount(0);
  await page.unroute(ORDERS);
});

test.describe('5. the order tracker', () => {
  test.use({ reducedMotion: 'reduce' });

  test('follows an order through Pending, Preparing and Completed, with no animation under reduced motion', async ({ page, request }) => {
    const order = await placeOrderWithOptions(request, TABLE, [{ menu_item_id: 'i-04', quantity: 1, option_ids: ['oc-04-size-large'] }]);
    await openTable(page, 'orders');
    const steps = page.getByTestId(`order-tracker-${order.order_number}`).locator('li');
    await expect(steps.nth(0)).toHaveAttribute('data-state', 'current');
    await expect(page.getByTestId(`order-estimate-${order.order_number}`)).toContainText('About');

    await moveOrder(request, order.order_number, 'Preparing');
    await expect(steps.nth(1)).toHaveAttribute('data-state', 'current', { timeout: 4000 });
    await expect(steps.nth(0)).toHaveAttribute('data-state', 'done');
    const animation = await steps.nth(1).evaluate((el) => getComputedStyle(el, '::after').animationName);
    expect(animation).toBe('none');

    await moveOrder(request, order.order_number, 'Completed');
    await expect(steps.nth(2)).toHaveAttribute('data-state', 'current', { timeout: 4000 });
    await expect(page.getByTestId(`order-estimate-${order.order_number}`)).toHaveCount(0);
  });

  test('a Cancelled order shows the word and no bar', async ({ page, request }) => {
    const order = await placeOrderWithOptions(request, TABLE, [{ menu_item_id: 'i-01', quantity: 1 }]);
    await openTable(page, 'orders');
    await moveOrder(request, order.order_number, 'Cancelled');
    await expect(page.getByTestId(`order-cancelled-${order.order_number}`)).toBeVisible({ timeout: 4000 });
    await expect(page.getByTestId(`order-tracker-${order.order_number}`)).toHaveCount(0);
  });
});

test('6. the ready banner shows within 2 seconds, once, and not again after a reload', async ({ page, request }) => {
  const order = await placeOrderWithOptions(request, TABLE, [{ menu_item_id: 'i-01', quantity: 1 }]);
  await openTable(page, 'orders');
  await page.waitForTimeout(300); // the live stream is open
  await moveOrder(request, order.order_number, 'Preparing');
  await moveOrder(request, order.order_number, 'Completed');
  const banner = page.getByTestId('ready-banner');
  await expect(banner).toContainText(`Your order #${order.order_number} is ready`, { timeout: 2000 });
  await expect(banner).toHaveCount(1);
  // it stays on whichever tab the diner is on
  await page.getByTestId('tab-menu').click();
  await expect(page.getByTestId('ready-banner')).toHaveCount(1);
  await page.getByTestId('ready-banner-dismiss').click();
  await expect(page.getByTestId('ready-banner')).toHaveCount(0);

  await page.reload();
  await expect(page.getByTestId('menu-screen')).toBeVisible();
  await page.waitForTimeout(500);
  await expect(page.getByTestId('ready-banner')).toHaveCount(0);
});

test('7. "Same again" adds what it can to the Cart at today\'s prices and opens it with one notice', async ({ page, request }) => {
  const order = await placeOrderWithOptions(request, TABLE, [
    { menu_item_id: 'i-04', quantity: 1, option_ids: ['oc-04-size-large', 'oc-04-extras-cheese'] },
    { menu_item_id: 'i-02', quantity: 2 },
  ]);
  await moveOrder(request, order.order_number, 'Preparing');
  await moveOrder(request, order.order_number, 'Completed');
  await openTable(page, 'orders');
  await page.getByTestId(`same-again-${order.order_number}`).click();
  await expect(page.getByTestId('cart-screen')).toBeVisible();
  await expect(page.getByTestId('cart-same-again-notice')).toContainText('Added 3 items');
  await expect(page.getByTestId('cart-qty-i-02')).toHaveText('2');
  await expect(page.locator('[data-testid^="cart-options-i-04"]')).toContainText('Large');
  await expect(page.getByTestId('cart-total')).toHaveText('$35.50'); // 18.50 + 2 x 8.50
});

test('8. the call buttons: "Request sent", then "Help is on the way." when staff respond', async ({ page, request }) => {
  await placeOrderWithOptions(request, TABLE, [{ menu_item_id: 'i-01', quantity: 1 }]);
  await openTable(page, 'orders');
  const waiter = page.getByTestId('call-waiter');
  await waiter.dblclick(); // a double tap makes one request
  await expect(waiter).toHaveText('Request sent');
  await expect(waiter).toBeDisabled();
  await expect(page.getByTestId('ask-bill')).toBeEnabled();
  const calls = (await (await request.get(`/api/tables/${TABLE}/calls`)).json()) as { calls: Array<{ id: string; kind: string }> };
  expect(calls.calls.filter((c) => c.kind === 'waiter')).toHaveLength(1);

  await request.post(`/api/service-calls/${calls.calls[0].id}/respond`);
  await expect(page.getByTestId('help-status')).toHaveText('Help is on the way.', { timeout: 4000 });
  await expect(waiter).toBeEnabled();
});

test('8b. there is no call card while the table has no orders', async ({ page }) => {
  await openTable(page, 'orders');
  await expect(page.getByTestId('orders-empty')).toBeVisible();
  await expect(page.getByTestId('help-card')).toHaveCount(0);
});

test("9. a launched Chef's special shows its card, can be ordered, and the card goes when it ends", async ({ page, request }) => {
  await openTable(page);
  await expect(page.getByTestId('chef-special')).toHaveCount(0);
  const special = await launchSpecial(request, { item_id: 'i-02', special_price_cents: 500, stock: 3, minutes: 10 });
  const card = page.getByTestId('chef-special');
  await expect(card).toBeVisible({ timeout: 3000 });
  await expect(card).toContainText('House Salad');
  await expect(card).toContainText('$5.00');
  await expect(card).toContainText('3 left');
  await expect(page.getByTestId('special-countdown')).toContainText(/Ends in 09:|Ends in 10:/);

  await page.getByTestId('special-add').click();
  await page.getByTestId('tab-cart').click();
  await expect(page.getByTestId(`cart-special-i-02@${special.id}`)).toBeVisible();
  await expect(page.getByTestId('cart-total')).toHaveText('$5.00');
  await placeFromCart(page);
  await expect(page.getByTestId('order-success-banner')).toBeVisible();
  const placed = (await (await request.get(`/api/tables/${TABLE}/orders?visit=current`)).json()) as { orders: Array<{ lines: Array<{ price_cents_each: number; special_id?: string }> }> };
  expect(placed.orders[0].lines[0]).toMatchObject({ price_cents_each: 500, special_id: special.id });

  await page.getByTestId('tab-menu').click();
  await expect(page.getByTestId('chef-special')).toContainText('2 left', { timeout: 3000 });
  await endSpecial(request);
  await expect(page.getByTestId('chef-special')).toHaveCount(0, { timeout: 3000 });
});

test('10. after Close table the thumbs show, change until Done, and are locked after', async ({ page, request }) => {
  await placeOrderWithOptions(request, TABLE, [{ menu_item_id: 'i-04', quantity: 1 }, { menu_item_id: 'i-02', quantity: 1 }]);
  await openTable(page);
  await page.waitForTimeout(300);
  const visitId = await closeTableAndRate(request, TABLE);

  const takeover = page.getByTestId('table-closed-takeover');
  await expect(takeover).toBeVisible({ timeout: 3000 });
  await expect(takeover).toContainText('This table was closed');
  await expect(page.getByTestId('rate-meal')).toContainText('Classic Burger');
  await expect(page.getByTestId('rate-meal')).toContainText('House Salad');

  await page.getByTestId('rate-up-i-04').click();
  await expect(page.getByTestId('rate-up-i-04')).toHaveAttribute('aria-pressed', 'true');
  await page.getByTestId('rate-down-i-04').click(); // changed before Done
  await expect(page.getByTestId('rate-down-i-04')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('rate-up-i-04')).toHaveAttribute('aria-pressed', 'false');
  await page.getByTestId('rate-up-i-02').click();
  await page.getByTestId('rate-done').click();
  await expect(page.getByTestId('rate-message')).toContainText('Thank you');
  await expect(page.getByTestId('rate-up-i-04')).toBeDisabled();

  // locked on the server too: a change is refused, the same thumb is accepted
  const changed = await request.post(`/api/tables/${TABLE}/ratings`, { data: { visit_id: visitId, ratings: [{ item_id: 'i-04', thumb: 'up' }], done: false } });
  expect(changed.status()).toBe(409);
  expect(((await changed.json()) as { error: { code: string } }).error.code).toBe('RATING_LOCKED');
});

test('11. a live menu change reaches an open Menu, and the Cart says what happened to the line', async ({ page, request }) => {
  await openTable(page);
  await page.getByTestId('add-item-i-02').click();
  await expect(page.getByTestId('cart-badge')).toHaveText('1');
  await changeMenuDirectly(request, 'i-02', { available: false });
  await expect(page.getByTestId('add-item-i-02')).toHaveCount(0, { timeout: 4000 }); // now "Sold out"
  await expect(page.getByTestId('cart-badge')).toHaveCount(0); // the line left the cart
  await page.getByTestId('tab-cart').click();
  await expect(page.getByTestId('cart-refresh-notice')).toContainText('House Salad');
  await expect(page.getByTestId('cart-empty')).toBeVisible();
});

test('12. Settings saves allergies, theme and sound, and they are still set after a reload', async ({ page }) => {
  await openTable(page);
  await page.getByTestId('open-settings').click();
  await expect(page.getByTestId('settings-sheet')).toBeVisible();
  await page.getByTestId('allergy-chip-peanuts').click();
  await page.getByTestId('allergy-chip-sesame').click();
  await page.getByTestId('theme-toggle-dark').click();
  await page.getByTestId('sound-toggle-muted').click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');

  await page.reload();
  await expect(page.getByTestId('menu-screen')).toBeVisible();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await page.getByTestId('open-settings').click();
  await expect(page.getByTestId('allergy-chip-peanuts')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('allergy-chip-sesame')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('allergy-chip-dairy')).toHaveAttribute('aria-pressed', 'false');
  await expect(page.getByTestId('theme-toggle-dark')).toHaveAttribute('aria-pressed', 'true');
  await expect(page.getByTestId('sound-toggle-muted')).toHaveAttribute('aria-pressed', 'true');

  // Follow device removes the saved choice
  await page.getByTestId('theme-toggle-device').click();
  await expect(page.locator('html')).not.toHaveAttribute('data-theme', /.+/);
  expect(await page.evaluate(() => localStorage.getItem('table-order.theme'))).toBeNull();
});

test('12b. the Settings sheet keeps focus inside and closes with Escape, returning focus to the gear', async ({ page }) => {
  await openTable(page);
  const gear = page.getByTestId('open-settings');
  await gear.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('settings-sheet')).toBeVisible();
  for (let i = 0; i < 20; i++) await page.keyboard.press('Tab');
  expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="settings-sheet"]'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('settings-sheet')).toHaveCount(0);
  await expect(gear).toBeFocused();
});

test('13. the options sheet closes with Escape, adds nothing and gives focus back to "+ Add"', async ({ page }) => {
  await openTable(page);
  const add = page.getByTestId('add-item-i-04');
  await add.focus();
  await page.keyboard.press('Enter');
  await expect(page.getByTestId('options-sheet')).toBeVisible();
  expect(await page.evaluate(() => !!document.activeElement?.closest('[data-testid="options-sheet"]'))).toBe(true);
  await page.keyboard.press('Escape');
  await expect(page.getByTestId('options-sheet')).toHaveCount(0);
  await expect(add).toBeFocused();
  await expect(page.getByTestId('cart-badge')).toHaveCount(0);
});

test('14. "Back to cart" on the allergy warning places nothing, and the warning comes again next time', async ({ page, request }) => {
  await page.addInitScript(() => localStorage.setItem('table-order.allergies', JSON.stringify(['dairy'])));
  await openTable(page);
  await page.getByTestId('add-item-i-01').click();
  await page.getByTestId('tab-cart').click();
  await page.getByTestId('place-order-button').click();
  await page.getByTestId('allergy-back').click();
  await expect(page.getByTestId('allergy-warning')).toHaveCount(0);
  await page.getByTestId('place-order-button').click();
  await expect(page.getByTestId('allergy-warning')).toBeVisible();
  const orders = (await (await request.get(`/api/tables/${TABLE}/orders?visit=current`)).json()) as { orders: unknown[] };
  expect(orders.orders).toHaveLength(0);
});

test('15. the estimate in an open Cart changes within 2 seconds when an order is placed', async ({ page, request }) => {
  await openTable(page);
  await page.getByTestId('add-item-i-02').click();
  await page.getByTestId('tab-cart').click();
  const estimate = page.getByTestId('wait-estimate');
  await expect(estimate).toContainText(/about \d+ min/);
  const before = Number(/about (\d+) min/.exec((await estimate.textContent()) ?? '')![1]);
  // another diner at the same table places an order: the kitchen is busier, and this table's stream says so
  await placeOrderWithOptions(request, TABLE, [{ menu_item_id: 'i-01', quantity: 1 }]);
  // two more minutes for the open order (the value is never below 1, so the new value is read from the server)
  const answer = (await (await request.get(`/api/estimate?table=${TABLE}`)).json()) as { estimate_minutes: number };
  expect(answer.estimate_minutes).toBeGreaterThan(before);
  await expect(estimate).toContainText(`about ${answer.estimate_minutes} min`, { timeout: 2000 });
});

test('16. "Mute" on the ready banner turns sound off in the browser', async ({ page, request }) => {
  const order = await placeOrderWithOptions(request, TABLE, [{ menu_item_id: 'i-01', quantity: 1 }]);
  await openTable(page, 'orders');
  await page.waitForTimeout(300);
  await moveOrder(request, order.order_number, 'Preparing');
  await moveOrder(request, order.order_number, 'Completed');
  await expect(page.getByTestId('ready-banner')).toBeVisible({ timeout: 2000 });
  await page.getByTestId('ready-banner-mute').click();
  expect(await page.evaluate(() => localStorage.getItem('table-order.sound'))).toBe('muted');
  await page.getByTestId('open-settings').click();
  await expect(page.getByTestId('sound-toggle-muted')).toHaveAttribute('aria-pressed', 'true');
});

test("17. a special in the Cart goes back to the regular price, with a notice, when the special ends", async ({ page, request }) => {
  await launchSpecial(request, { item_id: 'i-02', special_price_cents: 500, stock: 3, minutes: 10 });
  await openTable(page);
  await page.getByTestId('special-add').click();
  await page.getByTestId('tab-cart').click();
  await expect(page.getByTestId('cart-total')).toHaveText('$5.00');
  await endSpecial(request);
  await expect(page.getByTestId('cart-total')).toHaveText('$8.50', { timeout: 4000 });
  await expect(page.getByTestId('cart-refresh-notice')).toContainText("Chef's special ended");
});

for (const theme of ['dark', 'light'] as const) {
  test(`18. regression: every U6 control has a touch area of at least 44 x 44 px (${theme})`, async ({ page, request }) => {
    await page.addInitScript((t) => localStorage.setItem('table-order.theme', t), theme);
    const done = await placeOrderWithOptions(request, TABLE, [{ menu_item_id: 'i-02', quantity: 1 }]);
    await moveOrder(request, done.order_number, 'Preparing');
    await moveOrder(request, done.order_number, 'Completed');
    const live = await placeOrderWithOptions(request, TABLE, [{ menu_item_id: 'i-01', quantity: 1 }]);
    // The page posts its presence heartbeat as soon as its live stream is open: wait for that, not for a fixed time.
    const streamOpen = page.waitForResponse((r) => r.url().includes('/presence'));
    await openTable(page, 'orders');
    await streamOpen;
    await moveOrder(request, live.order_number, 'Preparing');
    await moveOrder(request, live.order_number, 'Completed');
    await expect(page.getByTestId('ready-banner')).toBeVisible({ timeout: 3000 });

    // Measure at rest: a control that is still sliding or scaling in has a box that is a hair under its size.
    // Only finite animations are waited for: a looping one (a pulse, a spinner) never finishes.
    const settle = () =>
      page.evaluate(() =>
        Promise.all(
          document
            .getAnimations()
            .filter((a) => a.effect?.getComputedTiming().iterations !== Infinity)
            .map((a) => a.finished.catch(() => undefined)),
        ),
      );
    const expectTouchArea = async (testId: string) => {
      await settle();
      for (const el of await page.getByTestId(testId).all()) {
        const box = await el.boundingBox();
        expect(box, `${testId} has no box`).not.toBeNull();
        expect(box!.width, `${testId} width`).toBeGreaterThanOrEqual(44);
        expect(box!.height, `${testId} height`).toBeGreaterThanOrEqual(44);
      }
    };
    for (const id of ['ready-banner-mute', 'ready-banner-dismiss', 'call-waiter', 'ask-bill', `same-again-${done.order_number}`]) await expectTouchArea(id);

    await page.getByTestId('open-settings').click();
    for (const a of ['gluten', 'dairy', 'eggs', 'peanuts', 'tree_nuts', 'fish', 'shellfish', 'soy', 'sesame']) await expectTouchArea(`allergy-chip-${a}`);
    await page.keyboard.press('Escape');

    await closeTableAndRate(request, TABLE);
    await expect(page.getByTestId('rate-meal')).toBeVisible({ timeout: 4000 });
    for (const id of ['i-02', 'i-01']) {
      await expectTouchArea(`rate-up-${id}`);
      await expectTouchArea(`rate-down-${id}`);
    }
  });
}

test('19. regression: hiding or selling out the special\'s item takes the card off an open Menu within 2 seconds, and it returns when the item does', async ({ page, request }) => {
  await launchSpecial(request, { item_id: 'i-02', special_price_cents: 500, stock: 3, minutes: 10 });
  await openTable(page);
  await expect(page.getByTestId('chef-special')).toBeVisible({ timeout: 3000 });

  expect((await request.patch('/api/staff/menu/items/i-02', { data: { hidden: true } })).ok()).toBe(true);
  await expect(page.getByTestId('chef-special')).toHaveCount(0, { timeout: 2000 });
  expect((await request.patch('/api/staff/menu/items/i-02', { data: { hidden: false } })).ok()).toBe(true);
  await expect(page.getByTestId('chef-special')).toBeVisible({ timeout: 2000 });

  await changeMenuDirectly(request, 'i-02', { available: false }); // the sold-out switch
  await expect(page.getByTestId('chef-special')).toHaveCount(0, { timeout: 2000 });
  await changeMenuDirectly(request, 'i-02', { available: true });
  await expect(page.getByTestId('chef-special')).toBeVisible({ timeout: 2000 });
});
