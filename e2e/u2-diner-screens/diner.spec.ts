import { test, expect, Page } from '@playwright/test';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function goToTable(page: Page, tableId = '1') {
  await page.goto(`/table/${tableId}`);
  await expect(page.getByTestId('tab-bar')).toBeVisible({ timeout: 5000 });
}

async function waitForMenuItems(page: Page) {
  await expect(page.getByTestId('menu-screen')).toBeVisible({ timeout: 5000 });
}

async function addFirstMenuItem(page: Page) {
  // Wait for the menu to load, then click the first + Add button
  await waitForMenuItems(page);
  const addButtons = page.locator('[data-testid^="add-item-"]');
  await expect(addButtons.first()).toBeVisible({ timeout: 5000 });
  await addButtons.first().click();
}

// ---------------------------------------------------------------------------
// Flow 8 (FR3.6): a table closed while the diner's page was shut resets the device on return
// Uses table 6 only (tables 1-4 belong to U3's specs, 7-10 to U4's).
// ---------------------------------------------------------------------------

test('Flow 8: a cart saved before the table was closed is gone when the page is opened again', async ({ page, request, baseURL }) => {
  await goToTable(page, '6');
  await addFirstMenuItem(page);
  await expect(page.getByTestId('cart-badge')).toHaveText('1');

  // The diner closes the tab (or goes offline); staff finish an order and close the table meanwhile.
  await page.goto('about:blank');
  const placed = await request.post(`${baseURL}/api/tables/6/orders`, {
    data: { placement_key: `f8-${Date.now()}`, lines: [{ menu_item_id: 'i-10', quantity: 1 }] },
  });
  expect(placed.status()).toBe(201);
  const orderNumber = ((await placed.json()) as { order_number: number }).order_number;
  for (const to of ['Preparing', 'Completed']) {
    expect((await request.post(`${baseURL}/api/orders/${orderNumber}/transition`, { data: { to, by: 'staff' } })).ok()).toBe(true);
  }
  expect((await request.post(`${baseURL}/api/tables/6/close`, { data: {} })).status()).toBe(200);

  // The next party opens the page: closed message, empty cart, nothing to place.
  await page.goto('/table/6');
  await expect(page.getByTestId('table-closed-takeover')).toBeVisible({ timeout: 5000 });
  await expect(page.getByTestId('table-closed-takeover')).toContainText('This table was closed');
  const savedCart = await page.evaluate(() => localStorage.getItem('cart:table:6'));
  expect(JSON.parse(savedCart ?? '[]')).toHaveLength(0);

  // Reloading is quiet: the device now knows about this close, and the cart starts empty.
  await page.reload();
  await expect(page.getByTestId('tab-bar')).toBeVisible({ timeout: 5000 });
  await expect(page.getByTestId('table-closed-takeover')).toHaveCount(0);
  await expect(page.getByTestId('cart-badge')).not.toBeVisible();
});

// ---------------------------------------------------------------------------
// Flow 1: Browse menu → add item → cart badge updates
// ---------------------------------------------------------------------------

test('Flow 1: browse menu, add item, cart badge updates', async ({ page }) => {
  await goToTable(page);

  // Menu tab is active by default
  await expect(page.getByTestId('tab-menu')).toHaveAttribute('aria-pressed', 'true');

  // Menu loads
  await waitForMenuItems(page);
  expect(await page.locator('[data-testid^="add-item-"]').count()).toBeGreaterThan(0);

  // Cart badge should not be visible initially
  await expect(page.getByTestId('cart-badge')).not.toBeVisible();

  // Add an item
  await addFirstMenuItem(page);

  // Cart badge should now show 1
  await expect(page.getByTestId('cart-badge')).toBeVisible();
  await expect(page.getByTestId('cart-badge')).toHaveText('1');
});

// ---------------------------------------------------------------------------
// Flow 2: View cart → place order → success banner → orders appear in My Orders
// ---------------------------------------------------------------------------

test('Flow 2: add item, view cart, place order, success banner, orders in My Orders', async ({
  page,
}) => {
  await goToTable(page, '2');

  // Add an item
  await addFirstMenuItem(page);

  // Switch to cart
  await page.getByTestId('tab-cart').click();
  await expect(page.getByTestId('cart-screen')).toBeVisible();

  // Place order button should be enabled
  const placeBtn = page.getByTestId('place-order-button');
  await expect(placeBtn).not.toBeDisabled();
  await placeBtn.click();

  // Confirm modal should appear
  await expect(page.getByTestId('confirm-modal')).toBeVisible();
  await page.getByTestId('confirm-modal-confirm').click();

  // Success banner
  await expect(page.getByTestId('order-success-banner')).toBeVisible({ timeout: 5000 });
  await expect(page.getByTestId('order-success-banner')).toContainText(/Order #\d+ placed/);
  // The diner lands on My orders after placing
  await expect(page.getByTestId('tab-orders')).toHaveAttribute('aria-pressed', 'true');

  // The new order is already listed on My orders
  await expect(page.getByTestId('orders-screen')).toBeVisible({ timeout: 5000 });
  await expect(page.locator('[data-testid^="order-card-"]').first()).toBeVisible({ timeout: 3000 });

  // Cart should be empty after placing order
  await page.getByTestId('tab-cart').click();
  await expect(page.getByTestId('cart-empty')).toBeVisible({ timeout: 3000 });
});

// ---------------------------------------------------------------------------
// Flow 3: Duplicate placement_key → the existing order is shown, no second order
// ---------------------------------------------------------------------------

test('Flow 3: duplicate placement_key shows the existing order', async ({ page }) => {
  await goToTable(page, '3');

  // Add item and place first order
  await addFirstMenuItem(page);
  await page.getByTestId('tab-cart').click();
  await expect(page.getByTestId('cart-screen')).toBeVisible();

  // Place the first order straight through the API with the cart's own placement_key,
  // and keep the order number the server gives back.
  const firstOrderNumber = await page.evaluate(async () => {
    const pk = sessionStorage.getItem('cart-placement-key:3');
    if (!pk) throw new Error('no placement_key in sessionStorage');

    const cartRaw = localStorage.getItem('cart:table:3');
    const cartItems = cartRaw ? JSON.parse(cartRaw) : [];
    const lines = cartItems.map((i: { menuItemId: string; quantity: number }) => ({
      menu_item_id: i.menuItemId,
      quantity: i.quantity,
    }));

    const res = await fetch('/api/tables/3/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ placement_key: pk, lines }),
    });
    return ((await res.json()) as { order_number: number }).order_number;
  });

  // Now place through the screen with the same key. The contract answers a repeated
  // placement_key with 200 and the existing order, so the banner shows that same number.
  const placeBtn = page.getByTestId('place-order-button');
  await expect(placeBtn).not.toBeDisabled();
  await placeBtn.click();
  await expect(page.getByTestId('confirm-modal')).toBeVisible();
  await page.getByTestId('confirm-modal-confirm').click();

  const banner = page.getByTestId('order-success-banner');
  await expect(banner).toBeVisible({ timeout: 5000 });
  await expect(banner).toContainText(`#${firstOrderNumber}`);
});

// ---------------------------------------------------------------------------
// Flow 4: My Orders shows Pending → Preparing status changes
// ---------------------------------------------------------------------------

test('Flow 4: My Orders shows order status updates', async ({ page }) => {
  await goToTable(page, '4');

  // Add item and place order
  await addFirstMenuItem(page);
  await page.getByTestId('tab-cart').click();
  await page.getByTestId('place-order-button').click();
  await page.getByTestId('confirm-modal-confirm').click();
  const toast = page.getByTestId('order-success-banner');
  await expect(toast).toBeVisible({ timeout: 5000 });

  // This test's own order number comes from the "Order #N placed" toast, so orders left on this
  // table by other tests cannot be mistaken for it.
  const toastText = (await toast.textContent()) ?? '';
  const orderNumber = Number(/#(\d+)/.exec(toastText)?.[1]);
  expect(Number.isInteger(orderNumber)).toBe(true);

  // Go to My Orders (the diner is already there after placing)
  await page.getByTestId('tab-orders').click();
  await expect(page.getByTestId('orders-screen')).toBeVisible({ timeout: 5000 });

  await expect(page.getByTestId(`order-card-${orderNumber}`)).toBeVisible({ timeout: 5000 });
  const statusPill = page.getByTestId(`order-status-${orderNumber}`);
  await expect(statusPill).toContainText('Pending');

  // Staff moves the order to Preparing
  const moved = await page.evaluate(async (num) => {
    const res = await fetch(`/api/orders/${num}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to: 'Preparing', by: 'staff' }),
    });
    return res.status;
  }, orderNumber);
  expect(moved).toBe(200);

  // The status updates by itself (the live event triggers a re-fetch)
  await expect(statusPill).toContainText('Preparing', { timeout: 5000 });
});

// ---------------------------------------------------------------------------
// Flow 5: TABLE_CLOSED event → takeover overlay shown, cart cleared
// ---------------------------------------------------------------------------

test('Flow 5: TABLE_CLOSED SSE event shows takeover overlay and clears the cart', async ({ page }) => {
  // "Close table" belongs to U4 and does not exist yet, so the server cannot send TABLE_CLOSED.
  // Replace the browser's EventSource with one the test controls and fire the event by hand.
  await page.addInitScript(() => {
    type Listener = (e: { data: string; lastEventId: string }) => void;
    class FakeEventSource {
      listeners: Record<string, Listener[]> = {};
      onopen: (() => void) | null = null;
      onerror: (() => void) | null = null;
      onmessage: Listener | null = null;
      constructor(_url: string) {
        (window as unknown as { __fakeES: FakeEventSource }).__fakeES = this;
        setTimeout(() => this.onopen?.(), 0);
      }
      addEventListener(type: string, fn: Listener) {
        (this.listeners[type] ??= []).push(fn);
      }
      close() {}
      emit(type: string, data: unknown) {
        for (const fn of this.listeners[type] ?? []) fn({ data: JSON.stringify(data), lastEventId: '' });
      }
    }
    (window as unknown as { EventSource: unknown }).EventSource = FakeEventSource;
  });

  await goToTable(page, '5');
  await waitForMenuItems(page);

  // Add item to cart so we can verify it clears
  await addFirstMenuItem(page);
  await expect(page.getByTestId('cart-badge')).toBeVisible();
  await expect(page.getByTestId('table-closed-takeover')).not.toBeVisible();

  // Two events arrive together; the takeover must still show
  await page.evaluate(() => {
    const es = (window as unknown as { __fakeES: { emit: (t: string, d: unknown) => void } }).__fakeES;
    es.emit('TABLE_CLOSED', { table_id: 5, archived_visit_id: 'v-1' });
    es.emit('ORDER_STATUS_CHANGED', { order_number: 1, table_id: 5, status: 'Completed' });
  });

  await expect(page.getByTestId('table-closed-takeover')).toBeVisible({ timeout: 3000 });
  await expect(page.getByTestId('table-closed-takeover')).toContainText('This table was closed');
  // The cart was cleared
  const stored = await page.evaluate(() => localStorage.getItem('cart:table:5'));
  expect(JSON.parse(stored ?? '[]')).toHaveLength(0);
});

// ---------------------------------------------------------------------------
// Flow 7: a sold-out change reaches a diner who is still on the Menu
// ---------------------------------------------------------------------------

test('Flow 7: staff marks an item sold out and the open Menu shows it within seconds', async ({ page, request, baseURL }) => {
  await goToTable(page, '8');
  await waitForMenuItems(page);

  // i-03 (Caesar Salad) is not used by other tests; this diner has not ordered, so has no visit yet
  const add = page.getByTestId('add-item-i-03');
  await expect(add).toBeVisible({ timeout: 5000 });

  try {
    await request.post(`${baseURL}/api/menu/items/i-03/availability`, { data: { available: false } });
    // The "+ Add" button is replaced by "Sold out", without leaving the tab or reloading
    await expect(page.getByTestId('add-item-i-03')).toHaveCount(0, { timeout: 4000 });
    await expect(page.getByTestId('menu-screen')).toContainText('Sold out');
  } finally {
    await request.post(`${baseURL}/api/menu/items/i-03/availability`, { data: { available: true } });
  }
  await expect(page.getByTestId('add-item-i-03')).toBeVisible({ timeout: 4000 });
});

// ---------------------------------------------------------------------------
// Flow 6: Keyboard-only navigation through tab bar and place order
// ---------------------------------------------------------------------------

test('Flow 6: keyboard-only navigation through tab bar', async ({ page }) => {
  await goToTable(page);
  await waitForMenuItems(page);

  // Tab to the cart tab button and activate it with keyboard
  const cartTab = page.getByTestId('tab-cart');
  await cartTab.focus();
  await cartTab.press('Enter');

  await expect(page.getByTestId('cart-screen')).toBeVisible({ timeout: 3000 });

  // Tab to orders
  const ordersTab = page.getByTestId('tab-orders');
  await ordersTab.focus();
  await ordersTab.press('Enter');

  // My orders shows the list, or its empty state when this table has no orders yet
  await expect(ordersTab).toHaveAttribute('aria-pressed', 'true');
  await expect(
    page.locator('[data-testid="orders-screen"], [data-testid="orders-empty"]')
  ).toBeVisible({ timeout: 3000 });

  // Tab back to menu
  const menuTab = page.getByTestId('tab-menu');
  await menuTab.focus();
  await menuTab.press('Enter');

  await expect(page.getByTestId('menu-screen')).toBeVisible({ timeout: 3000 });

  // Add item with keyboard then place order
  const addBtns = page.locator('[data-testid^="add-item-"]');
  await expect(addBtns.first()).toBeVisible({ timeout: 3000 });
  await addBtns.first().focus();
  await addBtns.first().press('Enter');

  await cartTab.focus();
  await cartTab.press('Enter');

  const placeBtn = page.getByTestId('place-order-button');
  await placeBtn.focus();
  await placeBtn.press('Enter');

  await expect(page.getByTestId('confirm-modal')).toBeVisible({ timeout: 3000 });

  const confirmBtn = page.getByTestId('confirm-modal-confirm');
  await confirmBtn.focus();
  await confirmBtn.press('Enter');

  await expect(page.getByTestId('order-success-banner')).toBeVisible({ timeout: 5000 });
});
