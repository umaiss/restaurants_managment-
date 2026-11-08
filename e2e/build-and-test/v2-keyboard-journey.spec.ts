import { test, expect, type Browser, type Locator, type Page } from '@playwright/test';
import { placeOrderWithOptions, resetTableState } from '../helpers';
import { resetTable } from './helpers';

// NFR3 (v2): every function of the app works with the keyboard alone.
// One journey, diner side and staff side, with no mouse. After a page address is opened, every control is
// reached with Tab, Shift+Tab or the arrow keys and operated with Enter, Space or Escape. Digits are typed.
// It runs on its own table (7) so the other specs' tables are left alone. A control that cannot be reached
// or operated fails the test with a message naming it.

const TABLE_ID = 7;
const SIGNED_OUT = { cookies: [], origins: [] };
const WRONG_PIN = '1111';
const RIGHT_PIN = '4242'; // the test PIN the Playwright config starts the server with

// Safari (WebKit) on a Mac skips buttons with a plain Tab; its documented key is Option+Tab.
let tabKey = 'Tab';
let backTabKey = 'Shift+Tab';
test.beforeEach(({ browserName }) => {
  const mac = browserName === 'webkit' && process.platform === 'darwin';
  tabKey = mac ? 'Alt+Tab' : 'Tab';
  backTabKey = mac ? 'Alt+Shift+Tab' : 'Shift+Tab';
});

/** A short, readable name of whatever has focus now, for failure messages. */
async function describeFocus(page: Page): Promise<string> {
  return page
    .evaluate(() => {
      const el = document.activeElement as HTMLElement | null;
      if (!el || el === document.body) return 'nothing (the page body)';
      const name = el.getAttribute('data-testid') || el.getAttribute('aria-label') || (el.textContent ?? '').trim().slice(0, 30);
      return `<${el.tagName.toLowerCase()}> "${name}"`;
    })
    .catch(() => 'unknown');
}

/** Press Tab until the control has focus. A control that Tab cannot reach fails the test, naming it. */
async function tabTo(page: Page, target: Locator, description: string, maxTabs = 160): Promise<void> {
  for (let i = 0; i <= maxTabs; i++) {
    const focused = await target.evaluate((el) => el === document.activeElement).catch(() => false);
    if (focused) return;
    await page.keyboard.press(tabKey);
  }
  throw new Error(`KEYBOARD: could not reach "${description}" with the Tab key within ${maxTabs} presses (focus ended on ${await describeFocus(page)})`);
}

/** The focused control must show a focus indicator: an outline of real width, or a box shadow. */
async function expectFocusIndicator(page: Page, description: string): Promise<void> {
  await expect
    .poll(
      async () =>
        page.evaluate(() => {
          const el = document.activeElement as HTMLElement | null;
          if (!el || el === document.body) return 'none: nothing has focus';
          const cs = getComputedStyle(el);
          const outline = cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0;
          const shadow = cs.boxShadow !== 'none' && cs.boxShadow !== '';
          return outline || shadow ? 'visible' : `none: outline ${cs.outlineStyle} ${cs.outlineWidth}, box-shadow ${cs.boxShadow}`;
        }),
      { message: `FOCUS INDICATOR: "${description}" shows no visible focus (no outline and no box shadow)`, timeout: 2000 }
    )
    .toBe('visible');
}

/** Reach a control by Tab, check it shows focus, and press the key (Enter by default). */
async function operate(page: Page, target: Locator, description: string, key: 'Enter' | 'Space' = 'Enter'): Promise<void> {
  await tabTo(page, target, description);
  await expectFocusIndicator(page, description);
  await page.keyboard.press(key === 'Space' ? 'Space' : 'Enter');
}

async function focusIsInside(page: Page, testId: string): Promise<boolean> {
  return page.evaluate((id) => !!document.activeElement?.closest(`[data-testid="${id}"]`), testId);
}

/** While a dialog is open, many Tab and Shift+Tab presses never take focus out of it (focus trap). */
async function expectFocusTrapped(page: Page, testId: string, description: string): Promise<void> {
  for (let i = 0; i < 14; i++) {
    await page.keyboard.press(tabKey);
    expect(await focusIsInside(page, testId), `FOCUS TRAP: Tab number ${i + 1} left "${description}" (focus on ${await describeFocus(page)})`).toBe(true);
  }
  for (let i = 0; i < 3; i++) {
    await page.keyboard.press(backTabKey);
    expect(await focusIsInside(page, testId), `FOCUS TRAP: Shift+Tab number ${i + 1} left "${description}" (focus on ${await describeFocus(page)})`).toBe(true);
  }
}

async function newPage(browser: Browser, baseURL: string, signedOut = false): Promise<Page> {
  const context = await browser.newContext({ baseURL, ...(signedOut ? { storageState: SIGNED_OUT } : {}) });
  return context.newPage();
}

test.describe('v2 keyboard-only journey (NFR3)', () => {
  test.beforeEach(async ({ request, baseURL }) => {
    await resetTable(request, baseURL!, TABLE_ID);
    // The items this journey uses must be on sale, whatever an earlier spec left behind.
    for (const id of ['i-04', 'i-11']) await request.post(`${baseURL}/api/menu/items/${id}/availability`, { data: { available: true } });
    await request.delete('/api/specials/current');
  });
  test.afterEach(async ({ request, baseURL }) => {
    await resetTable(request, baseURL!, TABLE_ID);
  });

  test('PIN screen, ordering with options and allergies, calls, kitchen stations, order actions, Same again: all by keyboard, every stop with a visible focus', async ({ browser, request, baseURL }) => {
    test.setTimeout(120_000);
    const url = baseURL!;
    const staff = await newPage(browser, url, true); // signed out: the PIN screen comes first
    const diner = await newPage(browser, url);

    try {
      // ---------------------------------------------------------------- 1. staff PIN screen, keyboard only
      await staff.goto('/staff');
      await expect(staff.getByTestId('pin-screen')).toBeVisible({ timeout: 8000 });
      await staff.keyboard.type(WRONG_PIN);
      await expect(staff.getByTestId('pin-dots')).toContainText('●●●●');
      await operate(staff, staff.getByTestId('pin-submit'), 'the PIN screen "Open" button (wrong PIN)');
      await expect(staff.getByTestId('pin-error'), 'a wrong PIN typed on the keyboard says so').toContainText('That PIN is not right');
      await staff.keyboard.type(RIGHT_PIN);
      await staff.keyboard.press('Enter');
      await expect(staff.getByTestId('kitchen-board'), 'the right PIN typed on the keyboard opens the Kitchen Board').toBeVisible({ timeout: 8000 });

      // ---------------------------------------------------------------- 2. diner: Menu, options sheet, Settings
      await diner.goto(`/table/${TABLE_ID}`);
      await expect(diner.getByTestId('menu-screen')).toBeVisible({ timeout: 8000 });

      // The options sheet: opened with Enter, focus moves inside and is trapped, Escape closes it and returns focus.
      const addBurger = diner.getByTestId('add-item-i-04');
      await operate(diner, addBurger, 'the "+ Add" button of Classic Burger (an item with options)');
      await expect(diner.getByTestId('options-sheet')).toBeVisible();
      expect(await focusIsInside(diner, 'options-sheet'), 'focus moves into the options sheet when it opens').toBe(true);
      await expectFocusIndicator(diner, 'the first control in the options sheet');
      await expectFocusTrapped(diner, 'options-sheet', 'the options sheet');
      await diner.keyboard.press('Escape');
      await expect(diner.getByTestId('options-sheet')).toHaveCount(0);
      await expect(addBurger, 'Escape returns focus to the "+ Add" button that opened the sheet').toBeFocused();
      await expect(diner.getByTestId('cart-badge'), 'Escape adds nothing').toHaveCount(0);

      // Open it again and choose options with Tab and Space.
      await diner.keyboard.press('Enter');
      await expect(diner.getByTestId('options-sheet')).toBeVisible();
      for (const [testId, label] of [
        ['option-choice-oc-04-size-large', 'the "Large" choice'],
        ['option-choice-oc-04-extras-cheese', 'the "Extra cheese" choice'],
        ['option-choice-oc-04-leave-onions', 'the "No onions" choice'],
      ] as const) {
        const choice = diner.getByTestId(testId);
        await operate(diner, choice, label, 'Space');
        await expect(choice, `${label} is chosen by Space`).toHaveAttribute('aria-checked', 'true');
      }
      await expect(diner.getByTestId('options-price')).toHaveText('$18.50');
      await operate(diner, diner.getByTestId('options-add'), 'the options sheet "Add to cart" button');
      await expect(diner.getByTestId('options-sheet')).toHaveCount(0);
      await expect(diner.getByTestId('cart-badge')).toHaveText('1');
      await expect(addBurger, 'after Add to cart, focus returns to the "+ Add" button').toBeFocused();

      // A plain item: Add straight to the cart. Shift+Tab then moves back to the item before it.
      const addJuice = diner.getByTestId('add-item-i-11');
      await operate(diner, addJuice, 'the "+ Add" button of Fresh Orange Juice');
      await expect(diner.getByTestId('cart-badge')).toHaveText('2');
      await diner.keyboard.press(backTabKey);
      expect(await addJuice.evaluate((el) => el === document.activeElement), 'Shift+Tab moves focus off the juice button').toBe(false);
      await expectFocusIndicator(diner, 'the control before the juice button (reached by Shift+Tab)');

      // Settings: open with Enter, toggle an allergy chip with Space, close with Escape.
      const gear = diner.getByTestId('open-settings');
      await operate(diner, gear, 'the Settings button');
      await expect(diner.getByTestId('settings-sheet')).toBeVisible();
      expect(await focusIsInside(diner, 'settings-sheet'), 'focus moves into the Settings sheet').toBe(true);
      const dairy = diner.getByTestId('allergy-chip-dairy');
      await operate(diner, dairy, 'the Dairy allergy chip', 'Space');
      await expect(dairy, 'the Dairy chip is switched on by Space').toHaveAttribute('aria-pressed', 'true');
      await expectFocusTrapped(diner, 'settings-sheet', 'the Settings sheet');
      await diner.keyboard.press('Escape');
      await expect(diner.getByTestId('settings-sheet')).toHaveCount(0);
      await expect(gear, 'Escape returns focus to the Settings button').toBeFocused();
      await expect(diner.getByTestId('menu-item-i-04').getByTestId('allergen-mark')).toHaveText(/Contains dairy/);

      // ---------------------------------------------------------------- 3. diner: Cart, allergy warning, place the order
      await operate(diner, diner.getByTestId('tab-cart'), 'the Cart tab');
      await expect(diner.getByTestId('cart-screen')).toBeVisible();
      await expect(diner.getByTestId('cart-total')).toHaveText('$23.00');
      const placeOrder = diner.getByTestId('place-order-button');
      await operate(diner, placeOrder, 'the Place order button');
      const warning = diner.getByTestId('allergy-warning');
      await expect(warning, 'the allergy warning appears for a burger when Dairy is on').toBeVisible();
      expect(await focusIsInside(diner, 'allergy-warning'), 'focus moves into the allergy warning').toBe(true);
      await expectFocusTrapped(diner, 'allergy-warning', 'the allergy warning');
      // "Back to cart" with Escape: nothing is ordered, and focus returns to Place order.
      await diner.keyboard.press('Escape');
      await expect(warning).toHaveCount(0);
      await expect(placeOrder, 'Escape on the allergy warning returns focus to Place order').toBeFocused();
      expect(((await (await request.get(`/api/tables/${TABLE_ID}/orders?visit=current`)).json()) as { orders: unknown[] }).orders).toHaveLength(0);
      // Again, and this time confirm with the keyboard.
      await diner.keyboard.press('Enter');
      await expect(warning).toBeVisible();
      await operate(diner, diner.getByTestId('allergy-confirm'), 'the allergy warning "Place order anyway" button');
      await expect(diner.getByTestId('orders-screen'), 'the order is placed and My orders opens').toBeVisible({ timeout: 8000 });

      const placed = (await (await request.get(`/api/tables/${TABLE_ID}/orders?visit=current`)).json()) as { orders: Array<{ order_number: number }> };
      expect(placed.orders.length).toBe(1);
      const orderA = placed.orders[0].order_number;

      // ---------------------------------------------------------------- 4. diner: call the waiter; staff respond, all by keyboard
      await expect(diner.getByTestId(`order-line-options-${orderA}-0`)).toHaveText('Large, Extra cheese, No onions');
      const waiter = diner.getByTestId('call-waiter');
      await operate(diner, waiter, 'the "Call the waiter" button');
      await expect(waiter).toHaveText('Request sent');

      await expect(staff.getByTestId(`order-card-${orderA}`)).toBeVisible({ timeout: 8000 });
      await expect(staff.getByTestId(`table-section-${TABLE_ID}`)).toContainText('Calling the waiter', { timeout: 3000 });
      await operate(staff, staff.getByTestId(`respond-${TABLE_ID}`), `the Respond button of Table ${TABLE_ID}`);
      await expect(staff.getByTestId(`table-section-${TABLE_ID}`)).not.toContainText('Calling the waiter', { timeout: 3000 });
      await expect(diner.getByTestId('help-status')).toHaveText('Help is on the way.', { timeout: 3000 });

      // ---------------------------------------------------------------- 5. staff: station tabs by arrow keys, station done buttons
      const tabAll = staff.getByTestId('station-tab-all');
      await tabTo(staff, tabAll, 'the selected station tab (All stations)');
      await expectFocusIndicator(staff, 'the All stations tab');
      await staff.keyboard.press('ArrowRight');
      await expect(staff.getByTestId('station-tab-grill'), 'ArrowRight selects the Grill tab').toHaveAttribute('aria-selected', 'true');
      await expect(staff.getByTestId('station-tab-grill')).toBeFocused();
      await expectFocusIndicator(staff, 'the Grill tab');
      const grillTicket = staff.getByTestId(`station-ticket-${orderA}`);
      await expect(grillTicket).toBeVisible({ timeout: 3000 });
      await expect(grillTicket).toContainText('Large, Extra cheese, No onions');
      await expect(grillTicket).not.toContainText('Fresh Orange Juice');
      await operate(staff, staff.getByTestId(`grill-done-${orderA}`), `the Grill "done" button of order #${orderA}`);
      await expect(staff.getByTestId(`station-ticket-${orderA}`)).toHaveCount(0);
      await expect.poll(async () => orderStatus(request, orderA), { timeout: 3000, message: 'Grill done makes the order Preparing' }).toBe('Preparing');

      // Back to the tab list, two arrow presses to Bar (Grill -> Cold -> Bar).
      await tabTo(staff, staff.getByTestId('station-tab-grill'), 'the selected station tab (Grill)');
      await staff.keyboard.press('ArrowRight');
      await staff.keyboard.press('ArrowRight');
      await expect(staff.getByTestId('station-tab-bar'), 'two ArrowRight presses select the Bar tab').toHaveAttribute('aria-selected', 'true');
      await expect(staff.getByTestId(`station-ticket-${orderA}`)).toContainText('Fresh Orange Juice', { timeout: 3000 });
      await operate(staff, staff.getByTestId(`bar-done-${orderA}`), `the Bar "done" button of order #${orderA}`);
      await expect.poll(async () => orderStatus(request, orderA), { timeout: 3000, message: 'Bar done makes the order Completed' }).toBe('Completed');

      // ---------------------------------------------------------------- 6. diner: ready banner and "Same again" by keyboard
      await expect(diner.getByTestId('ready-banner')).toContainText(`Your order #${orderA} is ready`, { timeout: 3000 });
      await operate(diner, diner.getByTestId('ready-banner-dismiss'), 'the ready banner Dismiss button');
      await expect(diner.getByTestId('ready-banner')).toHaveCount(0);
      await operate(diner, diner.getByTestId(`same-again-${orderA}`), `the "Same again" button of order #${orderA}`);
      await expect(diner.getByTestId('cart-screen')).toBeVisible();
      await expect(diner.getByTestId('cart-same-again-notice')).toContainText('Added 2 items');

      // ---------------------------------------------------------------- 7. staff: the other order actions on All stations
      // Two more orders at the same table, placed through the API (the diner side is already covered above).
      const orderB = await placeOrderWithOptions(request, TABLE_ID, [{ menu_item_id: 'i-11', quantity: 1 }]);
      const orderC = await placeOrderWithOptions(request, TABLE_ID, [{ menu_item_id: 'i-11', quantity: 1 }]);
      await tabTo(staff, staff.getByTestId('station-tab-bar'), 'the selected station tab (Bar)');
      await staff.keyboard.press('Home');
      await expect(staff.getByTestId('station-tab-all'), 'Home selects the All stations tab').toHaveAttribute('aria-selected', 'true');
      await expect(staff.getByTestId(`order-card-${orderB.order_number}`)).toBeVisible({ timeout: 3000 });
      await expect(staff.getByTestId(`order-card-${orderC.order_number}`)).toBeVisible({ timeout: 3000 });

      await operate(staff, staff.getByTestId(`btn-preparing-${orderB.order_number}`), `"Start preparing" of order #${orderB.order_number}`);
      await expect.poll(async () => orderStatus(request, orderB.order_number), { timeout: 3000 }).toBe('Preparing');
      await operate(staff, staff.getByTestId(`btn-complete-${orderB.order_number}`), `"Complete" of order #${orderB.order_number}`);
      await expect.poll(async () => orderStatus(request, orderB.order_number), { timeout: 3000 }).toBe('Completed');

      await operate(staff, staff.getByTestId(`btn-cancel-${orderC.order_number}`), `"Cancel" of order #${orderC.order_number}`);
      const keep = staff.getByTestId(`btn-cancel-keep-${orderC.order_number}`);
      await tabTo(staff, keep, `"Keep order" in the cancel question of order #${orderC.order_number}`);
      await expectFocusIndicator(staff, 'the "Keep order" button');
      await operate(staff, staff.getByTestId(`btn-cancel-confirm-${orderC.order_number}`), `"Yes, cancel" of order #${orderC.order_number}`);
      await expect.poll(async () => orderStatus(request, orderC.order_number), { timeout: 3000 }).toBe('Cancelled');

      // ---------------------------------------------------------------- 8. diner: the staff side's changes show on My orders
      await operate(diner, diner.getByTestId('tab-orders'), 'the My orders tab');
      await expect(diner.getByTestId('orders-screen')).toBeVisible();
      await expect(diner.getByTestId(`order-card-${orderB.order_number}`)).toBeVisible({ timeout: 3000 });
    } finally {
      await diner.context().close();
      await staff.context().close();
      await resetTableState(request, TABLE_ID);
    }
  });
});

async function orderStatus(request: import('@playwright/test').APIRequestContext, orderNumber: number): Promise<string> {
  const res = await request.get(`/api/tables/${TABLE_ID}/orders?visit=current`);
  const { orders } = (await res.json()) as { orders: Array<{ order_number: number; status: string }> };
  return orders.find((o) => o.order_number === orderNumber)?.status ?? 'none';
}
