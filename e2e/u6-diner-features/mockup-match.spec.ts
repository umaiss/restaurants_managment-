/**
 * Mockup-match spec for U6 (plan Step 11, BR7.1): diner-item-options, diner-settings, diner-closed-rate and the U6
 * parts of diner-menu, diner-cart and diner-orders, in both themes.
 *
 * For each screen it sets up the same state as the mockup, checks that the mockup really shows the words (so the
 * lists below are faithful), checks that the built screen shows them too, and saves the mockup and the built
 * screen side by side in test-results/mockup-match/u6-diner-features/<screen>-<theme>.png.
 *
 * LEFT OUT of the comparison, because another Unit owns it:
 *   U5 (foundation, already built and compared in e2e/u5-foundation): the page header, the tab bar, the category
 *     pills, the item cards' layout, the Cart's lines and quantity controls, the order cards' headers, "Cancel
 *     order", the design tokens.
 *   U7 (staff features): every staff screen (the other mockups); nothing in the diner mockups belongs to U7.
 *
 * WORDING DIFFERENCES accepted: see ACCEPTED_DIFFERENCES below; each is attached to the test report as an annotation.
 */
import { test, expect, type Browser, type Page } from '@playwright/test';
import fs from 'fs';
import path from 'path';
import { pathToFileURL } from 'url';
import { closeTableAndRate, endSpecial, launchSpecial, moveOrder, openCall, placeOrderWithOptions, resetTableState, respondCall } from '../helpers';

const MOCKUPS = path.resolve('aidlc/spaces/default/intents/261107-table-order-v2/inception/refined-mockups/mockups');
const OUT = path.join('test-results', 'mockup-match', 'u6-diner-features');
const THEMES = ['dark', 'light'] as const;
type Theme = (typeof THEMES)[number];
const TABLE = 5;

/** Each: what the mockup shows, what the built screen shows, and why the difference is accepted. */
const ACCEPTED_DIFFERENCES = {
  specialItem: "Menu: the mockup's Chef's special is a Lobster Linguine at $24.00 with 6 left; the seed menu has no such dish, so the built special is on the House Salad (same price and stock).",
  mockupDishes: "Menu: the mockup's item names and descriptions (Garlic Bread under Mains, \"Toasted baguette\" and so on) are sample text; the built menu shows the seed items. The marks and badges are compared, not the sample text.",
  readyTitle: "Orders: the mockup's ready banner says \"Order #9 is ready\"; the built banner says \"Your order #9 is ready\", as the approved functional design (W5, BR4.1) words it.",
  linesFormat: "Orders: the mockup writes a line as \"1 × Classic Burger\" (with spaces); the built screen keeps v1's \"1× Classic Burger\" format.",
  closedTakeover: "Table closed: the mockup says \"Table closed\" / \"Thank you for dining with us.\"; the built takeover keeps v1's \"This table was closed\" / \"Thanks for visiting!\" (v1 tests check them); Rate your meal below it is compared.",
  estimateNumber: 'Cart: the mockup says "about 14 min"; the built number is the live estimate (the words around it are compared).',
  optionsRequired: 'Options sheet: the seed\'s Size group is not required (a U5 deviation); the built page is given a menu where it is, as the mockup shows it.',
  sampleOrders: 'Orders: the mockup\'s order numbers (#12, #9, #8) and dishes are sample values; the built screen shows the numbers the server gave.',
};

test.use({ reducedMotion: 'reduce', viewport: { width: 390, height: 844 } }); // finished screens, never half-faded

test.beforeAll(() => {
  fs.mkdirSync(OUT, { recursive: true });
});

function mockupUrl(name: string): string {
  const file = path.join(MOCKUPS, `${name}.html`);
  expect(fs.existsSync(file), `mockup not found: ${file}`).toBe(true);
  return pathToFileURL(file).href;
}

async function openMockup(browser: Browser, name: string, theme: Theme) {
  const ctx = await browser.newContext({ viewport: { width: 1300, height: 1000 }, colorScheme: theme, reducedMotion: 'reduce' });
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
  const page = await browser.newPage({ viewport: { width: 1000, height: 1000 } });
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

/** The mockup really shows every word, and the built screen shows it too. */
async function expectWords(mockText: string, page: Page, words: string[], scope?: string) {
  const target = scope ? page.locator(scope) : page.locator('body');
  for (const word of words) {
    expect(mockText, `the mockup does not show "${word}"`).toContain(word);
    await expect(target, `the built screen does not show "${word}"`).toContainText(word);
  }
}

function accept(...keys: Array<keyof typeof ACCEPTED_DIFFERENCES>) {
  for (const k of keys) test.info().annotations.push({ type: 'accepted difference', description: ACCEPTED_DIFFERENCES[k] });
}

async function prepare(page: Page, theme: Theme, allergies: string[] = []) {
  await page.addInitScript(
    ([t, a]) => {
      localStorage.setItem('table-order.theme', t as string);
      if ((a as string[]).length > 0) localStorage.setItem('table-order.allergies', JSON.stringify(a));
    },
    [theme, allergies] as [string, string[]]
  );
}

/** Makes the burger's Size group required, as the mockup shows it (the seed's is not). */
async function requireBurgerSize(page: Page) {
  await page.route('**/api/menu', async (route) => {
    try {
      const res = await page.request.get(route.request().url());
      const body = (await res.json()) as { items: Array<{ options?: Array<{ name: string; required: boolean }> }> };
      for (const item of body.items) for (const g of item.options ?? []) if (g.name === 'Size') g.required = true;
      await route.fulfill({ json: body });
    } catch {
      // the page was already closing
    }
  });
}

test.beforeEach(async ({ request }) => {
  await resetTableState(request, TABLE);
  await endSpecial(request);
});
test.afterEach(async ({ request }) => {
  await endSpecial(request);
  await resetTableState(request, TABLE);
});

for (const theme of THEMES) {
  test.describe(`U6 screens (${theme})`, () => {
    test(`diner-item-options: the sheet's groups, choices, price changes, line price and Add to cart`, async ({ browser, page }) => {
      const mock = await openMockup(browser, 'diner-item-options', theme);
      await prepare(page, theme);
      await requireBurgerSize(page);
      await page.goto(`/table/${TABLE}`);
      await expect(page.getByTestId('menu-screen')).toBeVisible();
      await page.getByTestId('add-item-i-04').click();
      await page.getByTestId('option-choice-oc-04-size-large').click();
      await page.getByTestId('option-choice-oc-04-extras-cheese').click();
      await page.getByTestId('option-choice-oc-04-leave-onions').click();
      await expect(page.getByTestId('options-sheet')).toBeVisible();

      await expectWords(
        mock.text,
        page,
        ['Classic Burger', 'Size', 'Required', 'Regular', 'Large', '+$0.00', '+$3.00', 'Extras (choose any)', 'Extra cheese', 'Bacon', '+$1.00', '+$1.50', 'Leave out', 'No onions', 'Line price', '$18.50', 'Add to cart'],
        '[data-testid="options-sheet"]'
      );
      await expect(page.getByTestId('options-price')).toHaveText('$18.50');
      await expect(page.getByTestId('option-choice-oc-04-size-large')).toHaveAttribute('aria-checked', 'true');
      accept('optionsRequired');
      await savePair(browser, `diner-item-options-${theme}.png`, await mock.shot('.phone', 0), await page.screenshot());
      await mock.close();
    });

    test(`diner-settings: My allergies (nine chips), Theme, Sound alerts and their words`, async ({ browser, page }) => {
      const mock = await openMockup(browser, 'diner-settings', theme);
      await prepare(page, theme, ['dairy']);
      await page.goto(`/table/${TABLE}`);
      await expect(page.getByTestId('menu-screen')).toBeVisible();
      await page.getByTestId('open-settings').click();
      await expect(page.getByTestId('settings-sheet')).toBeVisible();

      await expectWords(
        mock.text,
        page,
        [
          'Settings', 'My allergies', 'Gluten', 'Dairy', 'Eggs', 'Peanuts', 'Tree nuts', 'Fish', 'Shellfish', 'Soy', 'Sesame',
          'Marks on the menu are guidance, not a promise. Tell the staff about serious allergies.', 'Theme', 'Follow device', 'Light', 'Dark',
          'Sound alerts', 'A short beep when your order is ready', 'On', 'Muted',
        ],
        '[data-testid="settings-sheet"]'
      );
      await expect(page.getByTestId('allergy-chip-dairy')).toHaveAttribute('aria-pressed', 'true');
      await expect(page.getByTestId('allergy-chip-gluten')).toHaveAttribute('aria-pressed', 'false');
      await expect(page.getByTestId('theme-toggle-device')).toHaveAttribute('aria-pressed', 'false'); // the theme was saved as Light or Dark
      await savePair(browser, `diner-settings-${theme}.png`, await mock.shot('.phone', 0), await page.screenshot());
      await mock.close();
    });

    test(`diner-closed-rate: Rate your meal, a thumbs up and down for each dish, and Done`, async ({ browser, page, request }) => {
      const mock = await openMockup(browser, 'diner-closed-rate', theme);
      await placeOrderWithOptions(request, TABLE, [
        { menu_item_id: 'i-04', quantity: 1 },
        { menu_item_id: 'i-02', quantity: 1 },
        { menu_item_id: 'i-08', quantity: 1 },
      ]);
      await prepare(page, theme);
      await page.goto(`/table/${TABLE}`);
      await expect(page.getByTestId('menu-screen')).toBeVisible();
      await page.waitForTimeout(300);
      await closeTableAndRate(request, TABLE);
      await expect(page.getByTestId('rate-meal')).toBeVisible({ timeout: 4000 });
      await page.getByTestId('rate-up-i-04').click(); // the mockup's first state: a thumbs up on the burger, a thumbs down on the salad
      await page.getByTestId('rate-down-i-02').click();
      await expect(page.getByTestId('rate-down-i-02')).toHaveAttribute('aria-pressed', 'true');

      await expectWords(mock.text, page, ['Rate your meal', 'Classic Burger', 'House Salad', 'Chocolate Fondant', 'Done'], '[data-testid="table-closed-takeover"]');
      await expect(page.getByLabel('Thumbs up for Classic Burger')).toBeVisible();
      await expect(page.getByLabel('Thumbs down for Chocolate Fondant')).toBeVisible();
      expect(mock.text).toContain('Table closed');
      accept('closedTakeover');
      await savePair(browser, `diner-closed-rate-${theme}.png`, await mock.shot('.phone', 0), await page.screenshot());
      await mock.close();
    });

    test(`diner-menu (U6 parts): the Chef's special card, "Make it yours", the allergen mark and "Allergens not set"`, async ({ browser, page, request }) => {
      const mock = await openMockup(browser, 'diner-menu', theme);
      await launchSpecial(request, { item_id: 'i-02', special_price_cents: 2400, stock: 6, minutes: 13 });
      await prepare(page, theme, ['dairy']);
      await page.goto(`/table/${TABLE}`);
      await expect(page.getByTestId('chef-special')).toBeVisible({ timeout: 6000 });
      await page.locator('main').evaluate((m) => m.scrollTo({ top: 0 }));

      await expectWords(mock.text, page, ["Chef's special", 'Ends in', '$24.00', '6 left', '+ Add', 'Make it yours', 'Allergens not set', 'Contains dairy', 'Settings']
        .filter((w) => w !== 'Settings'));
      await expect(page.getByTestId('open-settings')).toHaveAttribute('aria-label', 'Settings');
      expect(mock.text).toContain('⚠ Contains dairy');
      await expect(page.getByTestId('menu-item-i-01').getByTestId('allergen-mark')).toHaveText('⚠ Contains dairy');
      await expect(page.getByTestId('menu-item-i-01')).toHaveClass(/item-unsafe/);
      await expect(page.getByTestId('menu-item-i-04').getByText('Make it yours')).toBeVisible();
      await expect(page.getByTestId('menu-item-i-05').getByTestId('allergens-not-set')).toHaveText('Allergens not set');
      await expect(page.getByTestId('special-countdown')).toContainText(/Ends in 1[23]:\d\d/);
      accept('specialItem', 'mockupDishes');
      await savePair(browser, `diner-menu-${theme}.png`, await mock.shot('.phone', 0), await page.screenshot());
      await mock.close();
    });

    test(`diner-cart (U6 parts): options under the item, the estimate banner and the allergy warning`, async ({ browser, page }) => {
      const mock = await openMockup(browser, 'diner-cart', theme);
      await prepare(page, theme, ['dairy']);
      await page.goto(`/table/${TABLE}`);
      await expect(page.getByTestId('menu-screen')).toBeVisible();
      await page.getByTestId('add-item-i-04').click();
      await page.getByTestId('option-choice-oc-04-size-large').click();
      await page.getByTestId('option-choice-oc-04-extras-cheese').click();
      await page.getByTestId('option-choice-oc-04-leave-onions').click();
      await page.getByTestId('options-add').click();
      await page.getByTestId('add-item-i-02').click();
      await page.getByTestId('tab-cart').click();
      await expect(page.getByTestId('wait-estimate')).toContainText('Estimated wait: about');

      await expectWords(mock.text, page, ['Classic Burger', 'Large', 'Extra cheese', 'No onions', 'House Salad', 'Estimated wait: about', "Estimate, based on today's orders and how busy the kitchen is right now."], '[data-testid="cart-screen"]');
      await expect(page.getByTestId('cart-total')).toHaveText('$27.00'); // 18.50 + 8.50, the mockup's total
      expect(mock.text).toContain('$27.00');
      accept('estimateNumber', 'mockupDishes');
      await savePair(browser, `diner-cart-${theme}.png`, await mock.shot('.phone', 0), await page.screenshot());

      // The allergy warning (the mockup's second frame): a cart with Garlic Bread and "dairy" set
      await page.getByTestId('clear-cart').click();
      await page.getByTestId('tab-menu').click();
      await page.getByTestId('add-item-i-01').click();
      await page.getByTestId('tab-cart').click();
      await page.getByTestId('place-order-button').click();
      await expect(page.getByTestId('allergy-warning')).toBeVisible();
      await expectWords(
        mock.text,
        page,
        ['This order may not be safe for you', 'You told us you are allergic to', 'dairy', 'These items contain it:', 'Garlic Bread', 'contains dairy', 'Marks are guidance, not a promise. Tell the staff about serious allergies.', 'Place order anyway', 'Back to cart'],
        '[data-testid="allergy-warning"]'
      );
      expect(mock.text).toContain('⚠ This order may not be safe for you');
      await savePair(browser, `diner-cart-warning-${theme}.png`, await mock.shot('.phone', 1), await page.screenshot());
      await page.getByTestId('allergy-back').click();
      await page.getByTestId('clear-cart').click();
      await mock.close();
    });

    test(`diner-orders (U6 parts): the ready banner, Need something?, the tracker, the wait text, Running late and Same again`, async ({ browser, page, request }) => {
      const mock = await openMockup(browser, 'diner-orders', theme);
      const late = await placeOrderWithOptions(request, TABLE, [{ menu_item_id: 'i-08', quantity: 1 }]);
      const preparing = await placeOrderWithOptions(request, TABLE, [{ menu_item_id: 'i-04', quantity: 1, option_ids: ['oc-04-size-large', 'oc-04-extras-cheese', 'oc-04-leave-onions'] }]);
      await moveOrder(request, preparing.order_number, 'Preparing');
      const done = await placeOrderWithOptions(request, TABLE, [{ menu_item_id: 'i-10', quantity: 2 }, { menu_item_id: 'i-08', quantity: 1 }]);
      await moveOrder(request, done.order_number, 'Preparing');

      // The server's times are moved for this page only: one order well past its estimate, one 6 minutes into 14.
      await page.route(new RegExp(`/api/tables/${TABLE}/orders\\?visit=current`), async (route) => {
        try {
          const res = await page.request.get(route.request().url());
          const body = (await res.json()) as { orders: Array<{ order_number: number; placed_at: string; estimate_minutes: number }> };
          for (const o of body.orders) {
            if (o.order_number === late.order_number) { o.placed_at = new Date(Date.now() - 40 * 60_000).toISOString(); o.estimate_minutes = 10; }
            if (o.order_number === preparing.order_number) { o.placed_at = new Date(Date.now() - 6 * 60_000 - 5_000).toISOString(); o.estimate_minutes = 14; }
          }
          await route.fulfill({ json: body });
        } catch {
          // the page was already closing
        }
      });
      await prepare(page, theme);
      await page.goto(`/table/${TABLE}`);
      await page.getByTestId('tab-orders').click();
      await expect(page.getByTestId('orders-screen')).toBeVisible();
      await page.waitForTimeout(300);

      // staff answer a call, and the kitchen finishes the last order: the banner and "Help is on the way."
      const call = await openCall(request, TABLE, 'waiter');
      await respondCall(request, call.id);
      await moveOrder(request, done.order_number, 'Completed');
      await expect(page.getByTestId('ready-banner')).toContainText(`order #${done.order_number} is ready`, { timeout: 4000 });
      await expect(page.getByTestId('help-status')).toHaveText('Help is on the way.', { timeout: 4000 });
      await expect(page.getByTestId(`running-late-${late.order_number}`)).toBeVisible();
      await expect(page.getByTestId(`order-estimate-${preparing.order_number}`)).toHaveText('About 8 min left');
      await expect(page.getByTestId(`same-again-${done.order_number}`)).toBeVisible();

      await expectWords(mock.text, page, [
        'is ready', 'Your food is on its way to the table.', 'Need something?', 'Call the waiter', 'Ask for the bill', 'Help is on the way.',
        'About 8 min left', 'Classic Burger', 'Large, Extra cheese, No onions', 'Same again', 'Running late', 'Pending', 'Preparing', 'Completed',
      ]);
      const steps = await page.getByTestId(`order-tracker-${preparing.order_number}`).locator('li').allTextContents();
      expect(steps).toEqual(['Pending', 'Preparing', 'Completed']); // the mockup's three steps
      await expect(page.getByTestId(`order-tracker-${preparing.order_number}`).locator('li').nth(1)).toHaveAttribute('data-state', 'current');
      accept('readyTitle', 'linesFormat', 'sampleOrders');
      await savePair(browser, `diner-orders-${theme}.png`, await mock.shot('.phone', 0), await page.screenshot());
      await mock.close();
    });
  });
}
