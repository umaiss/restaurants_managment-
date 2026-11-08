/**
 * Mockup-match spec for U7 (plan Step 15, BR10.1): staff-station, staff-floor, staff-menu, staff-special, staff-sales,
 * staff-qr and the U7 parts of staff-board and staff-bill, in both themes.
 *
 * For each screen it sets up the same state as the mockup, checks that the mockup really shows the words (so the
 * list below is faithful), checks that the built screen shows them too, and saves the mockup and the built screen
 * side by side in test-results/mockup-match/u7-staff-kitchen-features/<screen>-<theme>.png.
 *
 * LEFT OUT of the comparison, because another Unit owns it or U5 already compared it:
 *   U5 (checked in e2e/u5-foundation/mockup-match.spec.ts): the side navigation, the Kitchen Board header and
 *     "Menu availability", order-card status words and v1 buttons, the bill's heading, order cards and Close table.
 *   U6 (diner features): every diner screen; nothing on a staff screen belongs to U6.
 *
 * WORDING AND DATA DIFFERENCES accepted: see ACCEPTED below; each is attached to the test report as an annotation.
 */
import { test, expect, type Browser, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { E2E_PORT, closeTableAndRate, endSpecial, launchSpecial, moveOrder, openCall, placeOrderWithOptions, resetTableState, setPresence, signInAsStaff } from '../helpers';
import { makeTwoDays, startOwnServer, type OwnServer } from './ownServer';

const MOCKUPS = path.resolve('aidlc/spaces/default/intents/261107-table-order-v2/inception/refined-mockups/mockups');
const OUT = path.join('test-results', 'mockup-match', 'u7-staff-kitchen-features');
const THEMES = ['dark', 'light'] as const;
type Theme = (typeof THEMES)[number];

/** Each: what the mockup shows, what the built screen shows, and why the difference is accepted. */
const ACCEPTED = {
  markCompleted: 'Kitchen Board: the mockup\'s button says "Complete"; the built button says "Mark completed" (v1\'s word, kept because v1\'s tests check it; U5 accepted the same).',
  readyToClose: 'Kitchen Board: the mockup shows a "Ready to close" badge on a table whose open orders are all done; the built card keeps v1\'s sentence "No open orders. Open the bill to close this table." (v1\'s tests check it).',
  orderNumber: 'Order and table numbers differ from the mockup\'s (#14, Table 7): the app numbers orders itself, so the test checks the words around the number.',
  doneTicket: 'Station board: the mockup also lists an order whose Grill part is already done ("Grill done", "Waiting for: Desserts"). The built board follows the rule BR1.1: an order leaves a station\'s board once that station is marked done, so no such ticket is shown.',
  optionGroupCount: 'Menu management: the mockup says "2 option groups" for the Classic Burger but draws three in the form; the seed has three (Size, Extras, Leave out), so the app says "3 option groups".',
  sizeRequired: 'Menu management: the mockup shows Size as "Choose one · required"; U5\'s seed makes the Size group not required (U5 deviation 1, until U6 ships the options sheet), so the app says "Choose one".',
  keptNote: 'Menu management: the mockup\'s error line adds "What you typed in the other fields is kept." next to the field; the app puts "What you typed is kept." in the summary above the form and the field message beside the field.',
  leftOf: 'Chef\'s special: the mockup says "Left of 10"; the server does not send the starting stock, so the app says "Left" with the number.',
  sellers: 'Past visits and sales: dates, counts and amounts are the test\'s own, not the mockup\'s (Saturday 7 November, 6 visits, $312.50); the words around them are compared.',
  noRatingsDay: 'Past visits and sales: the mockup says "No ratings this day." under an older day; the built page says "No ratings shown for this day." (ratings are shown for today only, BR7.6).',
  qrAll: 'QR codes: the mockup says "Tables 5 to 10 follow on the same page."; the built page shows all ten codes on the page, so there is no such note.',
  qrDraw: 'QR codes: the mockup draws a made-up 11 by 11 pattern; the built codes are real, made by the bundled package, and are larger.',
  billOrders: 'Table bill: only the option lines under the item are compared here (U5 compared the rest).',
};

test.use({ reducedMotion: 'reduce' }); // screenshots show the finished screen, never a half-faded one

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true });
});

function mockupUrl(name: string): string {
  const file = path.join(MOCKUPS, `${name}.html`);
  expect(fs.existsSync(file), `mockup not found: ${file}`).toBe(true);
  return pathToFileURL(file).href;
}

async function openMockup(browser: Browser, name: string, theme: Theme, width = 1300) {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' });
  const page = await ctx.newPage();
  await page.addInitScript((t) => localStorage.setItem('mockup-theme', t), theme);
  await page.goto(mockupUrl(name));
  await expect(page.locator('html')).toHaveAttribute('data-theme', theme);
  return {
    page,
    text: await page.locator('body').innerText(),
    shot: async (frame: string, index = 0) => page.locator(frame).nth(index).screenshot(),
    close: () => ctx.close(),
  };
}

async function savePair(browser: Browser, file: string, mock: Buffer, app: Buffer) {
  const page = await browser.newPage({ viewport: { width: 1500, height: 1000 } });
  const img = (b: Buffer) => `<img style="display:block;max-width:none" src="data:image/png;base64,${b.toString('base64')}">`;
  await page.setContent(
    `<body style="margin:0;padding:16px;background:#777;display:flex;gap:24px;align-items:flex-start;font:600 14px sans-serif;color:#fff">` +
      `<div><p style="margin:0 0 8px">Mockup</p>${img(mock)}</div><div><p style="margin:0 0 8px">Built app</p>${img(app)}</div></body>`
  );
  const target = path.join(OUT, file);
  await page.screenshot({ path: target, fullPage: true });
  await page.close();
  expect(fs.statSync(target).size).toBeGreaterThan(5000);
}

async function expectWords(mockText: string, page: Page, words: string[]) {
  for (const word of words) {
    expect(mockText, `the mockup does not show "${word}"`).toContain(word);
    await expect(page.locator('body'), `the built screen does not show "${word}"`).toContainText(word);
  }
}

function accept(...keys: Array<keyof typeof ACCEPTED>) {
  for (const k of keys) test.info().annotations.push({ type: 'accepted difference', description: ACCEPTED[k] });
}

async function setTheme(page: Page, theme: Theme) {
  await page.addInitScript((t) => localStorage.setItem('table-order.theme', t), theme);
}

const BURGER = { menu_item_id: 'i-04', quantity: 1, option_ids: ['oc-04-size-large', 'oc-04-extras-cheese', 'oc-04-leave-onions'] };
const ALL_TABLES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();

/** The board's reads of orders are given older placed times, so the timers show the mockup's 9 and 16 minutes. */
async function ageOrders(page: Page, ages: Record<number, number>) {
  for (const [table, minutes] of Object.entries(ages)) {
    await page.route(`**/api/tables/${table}/orders?visit=current`, async (route) => {
      const response = await route.fetch();
      const body = (await response.json()) as { orders: Array<{ placed_at: string }> };
      for (const o of body.orders) o.placed_at = minutesAgo(minutes);
      await route.fulfill({ response, json: body });
    });
  }
}

for (const theme of THEMES) {
  test.describe(`staff screens (${theme})`, () => {
    test.use({ viewport: { width: 1280, height: 800 }, colorScheme: theme });

    test.beforeEach(async ({ request }) => {
      for (const t of ALL_TABLES) await resetTableState(request, t);
    });
    test.afterEach(async ({ request }) => {
      for (const t of ALL_TABLES) await resetTableState(request, t);
      await endSpecial(request).catch(() => undefined);
    });

    test('staff-board: the new-order alert, Sound on / Muted, station tabs, timers, options on tickets and the call labels with Respond', async ({ browser, page, request }) => {
      const mock = await openMockup(browser, 'staff-board', theme);
      const burger = await placeOrderWithOptions(request, 5, [BURGER]);
      await moveOrder(request, burger.order_number, 'Preparing');
      await openCall(request, 5, 'waiter');
      const pizza = await placeOrderWithOptions(request, 3, [{ menu_item_id: 'i-06', quantity: 2 }, { menu_item_id: 'i-03', quantity: 1 }]);
      await moveOrder(request, pizza.order_number, 'Preparing');
      await ageOrders(page, { 5: 9, 3: 16 });

      await setTheme(page, theme);
      await page.goto('/staff');
      await expect(page.getByTestId('kitchen-board')).toHaveAttribute('data-sse', 'connected');
      await expect(page.getByTestId(`order-card-${burger.order_number}`)).toBeVisible();
      // a new order at table 7, and then that table asks for the bill
      const fresh = await placeOrderWithOptions(request, 7, [{ menu_item_id: 'i-05', quantity: 1 }, { menu_item_id: 'i-11', quantity: 1 }]);
      await expect(page.getByTestId(`new-order-alert-${fresh.order_number}`)).toContainText(`New order #${fresh.order_number} from Table 7`);
      await openCall(request, 7, 'bill');
      await expect(page.getByTestId('table-section-7')).toContainText('Asking for the bill');

      await expectWords(mock.text, page, [
        'New order #', 'from Table 7', 'Sound on', 'Muted', 'All stations', 'Grill', 'Cold', 'Bar', 'Desserts',
        'Asking for the bill', 'Calling the waiter', 'Respond', 'Slow', 'Late', 'Large, Extra cheese, No onions',
      ]);
      await expect(page.getByTestId(`timer-${burger.order_number}`)).toContainText('Slow');
      await expect(page.getByTestId(`timer-${pizza.order_number}`)).toContainText('Late');
      await expect(page.getByTestId('respond-5')).toBeVisible();
      await expect(page.getByTestId('respond-7')).toBeVisible();
      expect(await page.getByTestId('respond-5').boundingBox().then((b) => b!.height)).toBeGreaterThanOrEqual(36);
      accept('markCompleted', 'readyToClose', 'orderNumber');
      await savePair(browser, `staff-board-${theme}.png`, await mock.shot('.desk', 0), await page.screenshot());
      await mock.close();
    });

    test('staff-station: a station\'s tickets with timer, options, the other stations and "Grill done"', async ({ browser, page, request }) => {
      const mock = await openMockup(browser, 'staff-station', theme);
      const a = await placeOrderWithOptions(request, 5, [BURGER, { menu_item_id: 'i-11', quantity: 1 }]);
      await request.post(`/api/staff/orders/${a.order_number}/stations/Bar/done`);
      const b = await placeOrderWithOptions(request, 7, [{ menu_item_id: 'i-05', quantity: 1 }, { menu_item_id: 'i-11', quantity: 1 }]);
      await page.route('**/api/staff/stations/Grill/board', async (route) => {
        const response = await route.fetch();
        const body = (await response.json()) as { orders: Array<{ order_number: number; placed_at: string }> };
        for (const o of body.orders) if (o.order_number === a.order_number) o.placed_at = minutesAgo(9);
        await route.fulfill({ response, json: body });
      });

      await setTheme(page, theme);
      await page.goto('/staff');
      await page.getByTestId('station-tab-grill').click();
      await expect(page.getByTestId(`station-ticket-${a.order_number}`)).toBeVisible();
      await expect(page.getByTestId(`station-ticket-${b.order_number}`)).toBeVisible();

      await expectWords(mock.text, page, [
        'Order #', 'Large, Extra cheese, No onions', 'Other stations on this order: Bar (done)', 'Other stations on this order: Bar (waiting)',
        'Grill done', 'Slow', 'Table 5', 'Table 7',
      ]);
      await expect(page.getByTestId(`grill-done-${a.order_number}`)).toHaveText('Grill done');
      await expect(page.getByTestId(`station-ticket-${a.order_number}`)).toContainText('Classic Burger');
      accept('doneTicket', 'orderNumber');
      await savePair(browser, `staff-station-${theme}.png`, await mock.shot('.desk', 0), await page.screenshot());
      await mock.close();
    });

    test('staff-floor: the five states as words and colours, and the legend', async ({ browser, page, request }) => {
      const mock = await openMockup(browser, 'staff-floor', theme);
      await placeOrderWithOptions(request, 1, [{ menu_item_id: 'i-11', quantity: 1 }]); // Waiting
      await placeOrderWithOptions(request, 7, [{ menu_item_id: 'i-11', quantity: 1 }]); // Waiting
      for (const t of [3, 8]) {
        const o = await placeOrderWithOptions(request, t, [{ menu_item_id: 'i-11', quantity: 1 }]); // Eating
        await moveOrder(request, o.order_number, 'Preparing');
        await moveOrder(request, o.order_number, 'Completed');
      }
      await placeOrderWithOptions(request, 5, [{ menu_item_id: 'i-11', quantity: 1 }]);
      await openCall(request, 5, 'bill'); // Needs the bill

      await setTheme(page, theme);
      await page.goto('/staff/floor');
      await expect(page.getByTestId('floor-table-10')).toBeVisible();
      await setPresence(page, 4, 1); // Browsing
      await setPresence(page, 10, 1);
      await expect(page.getByTestId('floor-table-4')).toContainText('Browsing', { timeout: 3000 });

      await expectWords(mock.text, page, ['Floor map', 'Updated live', 'Empty', 'Browsing', 'Waiting', 'Eating', 'Needs the bill', 'Each state also shows as a word, so colour is never the only signal.']);
      for (const [t, word] of [[1, 'Waiting'], [2, 'Empty'], [3, 'Eating'], [4, 'Browsing'], [5, 'Needs the bill']] as const) {
        await expect(page.getByTestId(`floor-table-${t}`)).toContainText(word); // the same tables as the mockup's first five
      }
      accept();
      await savePair(browser, `staff-floor-${theme}.png`, await mock.shot('.desk', 0), await page.screenshot());
      await mock.close();
    });

    test('staff-menu: the item list, the item form with allergens and option groups, and an invalid save', async ({ browser, page, request }) => {
      const mock = await openMockup(browser, 'staff-menu', theme);
      expect((await request.patch('/api/staff/menu/items/i-07', { data: { hidden: true } })).ok()).toBe(true); // Pasta Carbonara hidden
      try {
        await setTheme(page, theme);
        await page.goto('/staff/menu');
        await expect(page.getByTestId('menu-management')).toBeVisible();
        await page.getByTestId('edit-i-04').click();
        await expect(page.getByTestId('item-form')).toContainText('Edit Classic Burger');
        // an invalid save: the Name is empty
        await page.getByLabel('Name', { exact: true }).fill('');
        await page.getByTestId('save-item').click();
        await expect(page.getByTestId('field-f-name')).toContainText('Name is required.');
        await page.getByLabel('Name', { exact: true }).fill('Classic Burger'); // the form shows the name again, as in the mockup's top half

        await expectWords(mock.text, page, [
          'Menu management', 'Add category', 'Add item', 'Mains', 'Item', 'Station', 'Price', 'Classic Burger', 'Grilled Salmon', 'Margherita Pizza',
          'Pasta Carbonara', 'Allergens not set', 'Hidden', 'Edit', 'Show', 'Edit Classic Burger', 'Changes reach open menus live', 'Name', 'Description',
          'Price (dollars)', 'Image (emoji or web address)', 'Category', 'Allergens it contains', 'Gluten', 'Dairy', 'Eggs', 'Peanuts', 'Tree nuts', 'Fish',
          'Shellfish', 'Soy', 'Sesame', 'Options', 'Choose one', 'Choose any', 'Remove an ingredient', 'Regular +$0.00 · Large +$3.00', 'Add option group',
          'Save', 'Hide item', 'Name is required.',
        ]);
        await expect(page.getByLabel('Price (dollars)')).toHaveValue('14.50');
        await expect(page.getByLabel('Image (emoji or web address)')).toHaveValue('🍔');
        await expect(page.getByRole('button', { name: 'Move category up' }).first()).toBeVisible();
        accept('optionGroupCount', 'sizeRequired', 'keptNote');
        await savePair(browser, `staff-menu-${theme}.png`, await mock.shot('.desk', 0), await page.screenshot({ fullPage: true }));
      } finally {
        await request.patch('/api/staff/menu/items/i-07', { data: { hidden: false } });
        await mock.close();
      }
    });

    test('staff-special: the live special with its countdown and stock, and the launch form with a refused value', async ({ browser, page, request }) => {
      const mock = await openMockup(browser, 'staff-special', theme);
      await launchSpecial(request, { item_id: 'i-06', special_price_cents: 2400, stock: 10, minutes: 13 });
      await setTheme(page, theme);
      await page.goto('/staff/special');
      await expect(page.getByTestId('special-live')).toContainText('Margherita Pizza');
      await page.getByLabel('Menu item').selectOption('i-07');
      await page.getByLabel('Special price (dollars)').fill('10.00');
      await page.getByLabel('Stock (1 to 999)').fill('0');
      await page.getByLabel('Runs for (minutes)').fill('30');
      await page.getByTestId('launch-special').click();
      await expect(page.getByTestId('field-s-stock')).toContainText('Stock must be a whole number from 1 to 999.');

      await expectWords(mock.text, page, [
        "Chef's special", 'Updated live', 'Live now', 'Ends in', 'Special price', 'Left', 'Shown on every open Menu. It disappears when the stock reaches 0 or the time runs out.',
        'End special now', 'Launch a special', 'Launching a new special ends the current one.', 'Menu item', 'Special price (dollars)', 'Stock (1 to 999)',
        'Runs for (minutes)', 'Launch special', 'Stock must be a whole number from 1 to 999.',
      ]);
      await expect(page.getByTestId('special-countdown')).toContainText(/Ends in 1[23]:\d\d/);
      accept('leftOf');
      await savePair(browser, `staff-special-${theme}.png`, await mock.shot('.desk', 0), await page.screenshot());
      await mock.close();
    });

    test('staff-qr: the heading, the address line, Print, the network note and a code with its label for every table', async ({ browser, page }) => {
      const mock = await openMockup(browser, 'staff-qr', theme);
      await setTheme(page, theme);
      await page.goto('/staff/qr');
      await expect(page.getByTestId('qr-table-10')).toBeVisible();
      await expectWords(mock.text, page, [
        'QR codes', 'Codes open', 'Print', "Open this page on the restaurant's network address",
        'Phones can only scan codes that point to an address they can reach', 'Table 1', 'Table 4', '/table/1',
      ]);
      await expect(page.getByTestId('qr-address')).toContainText('/table/<number>');
      accept('qrAll', 'qrDraw');
      await savePair(browser, `staff-qr-${theme}.png`, await mock.shot('.desk', 0), await page.screenshot());
      await mock.close();
    });

    test('staff-bill: the chosen options under the item and the frozen line price', async ({ browser, page, request }) => {
      const mock = await openMockup(browser, 'staff-bill', theme);
      const o = await placeOrderWithOptions(request, 5, [{ menu_item_id: 'i-10', quantity: 2 }, { menu_item_id: 'i-08', quantity: 1 }]);
      await moveOrder(request, o.order_number, 'Preparing');
      await moveOrder(request, o.order_number, 'Completed');
      const b = await placeOrderWithOptions(request, 5, [BURGER, { menu_item_id: 'i-02', quantity: 1 }]);
      await moveOrder(request, b.order_number, 'Preparing');
      await moveOrder(request, b.order_number, 'Completed');

      await setTheme(page, theme);
      await page.goto('/staff/tables/5');
      await expect(page.getByTestId(`bill-order-${b.order_number}`)).toBeVisible();
      await expectWords(mock.text, page, ['Large, Extra cheese, No onions', 'Combined total', 'Close table', 'Completed', 'Classic Burger', 'House Salad', 'Sparkling Water', 'Chocolate Fondant']);
      await expect(page.getByTestId(`bill-order-${b.order_number}`)).toContainText('$18.50');
      await expect(page.getByTestId('bill-combined-total')).toHaveText('$43.50'); // 7.00 + 9.50 + 18.50 + 8.50, as in the mockup
      accept('billOrders');
      await savePair(browser, `staff-bill-${theme}.png`, await mock.shot('.desk', 0), await page.screenshot());
      await mock.close();
    });
  });
}

// ------------------------------------------------------------------ staff-sales needs two days, so it has its own server

for (const theme of THEMES) {
  test.describe(`staff-sales (${theme})`, () => {
    let server: OwnServer;
    test.beforeAll(async () => {
      server = await startOwnServer(E2E_PORT + 200, 'u7-mockup-sales.db');
      await makeTwoDays(server);
    });
    test.afterAll(async () => {
      await server?.stop();
    });

    test('staff-sales: day cards with totals, the average or "No completed orders", best sellers and the rated dishes', async ({ browser }) => {
      const mock = await openMockup(browser, 'staff-sales', theme);
      const context = await browser.newContext({ baseURL: server.origin, viewport: { width: 1280, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' });
      const page = await context.newPage();
      await signInAsStaff(page, server.api);
      await setTheme(page, theme);
      await page.goto('/staff/sales');
      await expect(page.getByTestId('sales-day-today')).toBeVisible();

      await expectWords(mock.text, page, [
        'Past visits and sales', 'visits', 'orders', 'Total sales', 'Average time to Completed', 'Average per visit', 'Best sellers', 'Sold',
        'Best rated today', 'Worst rated today', 'No completed orders',
      ]);
      await expect(page.getByTestId('sales-day-today').getByTestId('sales-total')).toHaveText('$55.50');
      accept('sellers', 'noRatingsDay');
      await savePair(browser, `staff-sales-${theme}.png`, await mock.shot('.desk', 0), await page.screenshot({ fullPage: true }));
      await context.close();
      await mock.close();
    });
  });
}
