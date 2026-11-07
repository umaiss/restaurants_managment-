import { test, expect, type Locator, type Page } from '@playwright/test';
import { resetTable } from './helpers';

// NFR6: the whole app is usable by keyboard alone.
// This journey never clicks. After the page address is opened, every control is reached with Tab and
// operated with Enter. It runs on its own table (6) so the other specs' tables are left alone.

const TABLE_ID = 6;

// Safari (WebKit) on a Mac skips buttons with a plain Tab by default; its documented key for moving
// through every control is Option+Tab. Every other browser uses Tab.
let tabKey = 'Tab';

test.beforeEach(({ browserName }) => {
  tabKey = browserName === 'webkit' && process.platform === 'darwin' ? 'Alt+Tab' : 'Tab';
});

// Press Tab until the given control has focus (at most `maxTabs` presses), so a control that cannot
// be reached by keyboard fails the test instead of being clicked around.
async function tabTo(page: Page, target: Locator, description: string, maxTabs = 80): Promise<void> {
  for (let i = 0; i <= maxTabs; i++) {
    const focused = await target.evaluate((el) => el === document.activeElement).catch(() => false);
    if (focused) return;
    await page.keyboard.press(tabKey);
  }
  throw new Error(`Could not reach "${description}" with the Tab key within ${maxTabs} presses`);
}

async function activate(page: Page, target: Locator, description: string): Promise<void> {
  await tabTo(page, target, description);
  await page.keyboard.press('Enter');
}

test.describe('Keyboard-only journey (NFR6)', () => {
  test('a diner orders, the kitchen prepares and completes it, and staff close the table, all by keyboard', async ({ browser, request, baseURL }) => {
    const url = baseURL!;
    // Make sure the first menu item is on sale, whatever an earlier spec left behind.
    await request.post(`${url}/api/menu/items/i-01/availability`, { data: { available: true } });

    const diner = await browser.newPage();
    const staff = await browser.newPage();

    try {
      // 1. Diner: add the first dish to the cart.
      await diner.goto(`/table/${TABLE_ID}`);
      await expect(diner.getByTestId('menu-screen')).toBeVisible({ timeout: 8000 });
      const addButton = diner.getByRole('button', { name: /^Add .* to cart$/ }).first();
      await activate(diner, addButton, 'the first Add button');
      await expect(diner.getByTestId('cart-badge')).toBeVisible();

      // 2. Diner: open the Cart tab, place the order and confirm.
      await activate(diner, diner.getByTestId('tab-cart'), 'the Cart tab');
      await expect(diner.getByTestId('cart-screen')).toBeVisible();
      await activate(diner, diner.getByTestId('place-order-button'), 'Place order');
      const modal = diner.getByTestId('confirm-modal');
      await expect(modal).toBeVisible();
      // Focus is already inside the dialog, and Tab keeps it there.
      await expect(modal.locator(':focus')).toHaveCount(1);
      await activate(diner, diner.getByTestId('confirm-modal-confirm'), 'the Place order confirmation');
      await expect(diner.getByTestId('orders-screen')).toBeVisible({ timeout: 8000 });

      const placed = await request.get(`${url}/api/tables/${TABLE_ID}/orders?visit=current`);
      const { orders } = (await placed.json()) as { orders: Array<{ order_number: number }> };
      expect(orders.length).toBeGreaterThan(0);
      const orderNumber = orders[orders.length - 1].order_number;

      // 3. Staff: start preparing, then mark completed.
      await staff.goto('/staff');
      await expect(staff.getByTestId(`order-card-${orderNumber}`)).toBeVisible({ timeout: 8000 });
      await activate(staff, staff.getByTestId(`btn-preparing-${orderNumber}`), 'Start preparing');
      await expect(staff.getByTestId(`btn-complete-${orderNumber}`)).toBeVisible({ timeout: 5000 });
      await activate(staff, staff.getByTestId(`btn-complete-${orderNumber}`), 'Mark completed');
      await expect(staff.getByTestId(`order-card-${orderNumber}`)).toContainText('Completed', { timeout: 5000 });

      // 4. Staff: open the bill from the table's header link.
      await activate(staff, staff.getByRole('link', { name: `Open bill for Table ${TABLE_ID}` }), 'the Table 6 bill link');
      await expect(staff.getByTestId('table-bill-screen')).toBeVisible({ timeout: 8000 });
      await expect(staff.getByTestId('bill-combined-total')).toBeVisible();

      // 5. Staff: close the table (the button turns on once every order is done).
      const closeButton = staff.getByTestId('btn-close-table');
      await expect(closeButton).toBeEnabled({ timeout: 5000 });
      await activate(staff, closeButton, 'Close table');
      await expect(staff.getByTestId('confirm-modal')).toBeVisible();
      await activate(staff, staff.getByTestId('confirm-modal-confirm'), 'the Close table confirmation');

      // 6. The staff member is back on the board without the table, and the diner device resets.
      await expect(staff.getByTestId('kitchen-board')).toBeVisible({ timeout: 8000 });
      await expect(staff.getByTestId(`table-section-${TABLE_ID}`)).toHaveCount(0);
      await expect(diner.getByTestId('table-closed-takeover')).toBeVisible({ timeout: 4000 });
    } finally {
      await diner.close();
      await staff.close();
      await resetTable(request, url, TABLE_ID);
    }
  });

  test('Escape closes a confirmation dialog and focus returns to the control that opened it', async ({ page }) => {
    await page.goto(`/table/${TABLE_ID}`);
    await expect(page.getByTestId('menu-screen')).toBeVisible({ timeout: 8000 });
    await activate(page, page.getByRole('button', { name: /^Add .* to cart$/ }).first(), 'the first Add button');
    await activate(page, page.getByTestId('tab-cart'), 'the Cart tab');
    const placeOrder = page.getByTestId('place-order-button');
    await activate(page, placeOrder, 'Place order');
    await expect(page.getByTestId('confirm-modal')).toBeVisible();

    await page.keyboard.press('Escape');

    await expect(page.getByTestId('confirm-modal')).toHaveCount(0);
    await expect(placeOrder).toBeFocused();
  });
});
