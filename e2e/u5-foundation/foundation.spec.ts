/**
 * U5 foundation: browser tests of the main flows (plan Step 18, BR1.x, BR8.x, BR9.x, BR10.x, BR13.2).
 *
 * Nine flows: (1) the PIN screen, wrong PIN, lockout, right PIN, sign-out; (2) a request with no session
 * returns the screen to the PIN screen; (3) the theme control and its saved choice; (4) an order with
 * options reaches the staff board within 2 seconds; (5) the last Chef's special goes to one diner;
 * (6) the call and rating helpers drive the routes and their events; (7) an open page shows as present;
 * (8) the new look keeps the tab bar, category pills and 44 px touch areas in both themes; (9) all motion
 * stops under reduced motion.
 *
 * Every test starts signed in (the Playwright config signs in once). Flows 1 and 2 start signed out.
 * Tables 2 and 4 belong to this file; each test puts them back as it found them.
 */
import { test, expect, type Page } from '@playwright/test';
import {
  signInAsStaff, placeOrderWithOptions, moveOrder, launchSpecial, endSpecial, openCall, respondCall,
  closeTableAndRate, resetTableState, setPresence, LOCKOUT_ORIGIN, STAFF_PIN,
} from '../helpers';

const SIGNED_OUT = { cookies: [], origins: [] };

const token = (page: Page, name: string) =>
  page.evaluate((n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim(), name);

/** Opens a live stream in the page and collects the named events it receives. */
async function listen(page: Page, url: string, names: string[]) {
  await page.evaluate(
    ([u, n]) =>
      new Promise<void>((resolve) => {
        const w = window as unknown as { __ev?: Array<{ name: string; data: any }>; __es?: EventSource[] };
        w.__ev ??= [];
        const es = new EventSource(u as string);
        (w.__es ??= []).push(es);
        for (const name of n as string[]) es.addEventListener(name, (e) => w.__ev!.push({ name, data: JSON.parse((e as MessageEvent).data) }));
        es.addEventListener('HELLO', () => resolve());
        setTimeout(resolve, 3000);
      }),
    [url, names] as [string, string[]]
  );
}
const received = (page: Page, name: string) =>
  page.evaluate((n) => ((window as unknown as { __ev?: Array<{ name: string; data: any }> }).__ev ?? []).filter((e) => e.name === n).map((e) => e.data), name);

async function typePin(page: Page, pin: string) {
  await page.keyboard.type(pin);
  await page.keyboard.press('Enter');
}

test.describe('Flow 1: the PIN screen, lockout and sign-out', () => {
  test.use({ storageState: SIGNED_OUT });

  test('a wrong PIN says so with the tries left; five wrong tries lock the address, even for the right PIN', async ({ page }, testInfo) => {
    // This locks one client address for 60 seconds (BR1.4), so it runs once, from the IPv6 address only this test uses.
    test.skip(testInfo.project.name !== 'chromium', 'locks an address for 60 seconds, so it runs in one project only');
    await page.goto(`${LOCKOUT_ORIGIN}/staff`);
    await expect(page.getByTestId('pin-screen')).toBeVisible();
    await expect(page.getByTestId('staff-view')).toHaveCount(0);

    await typePin(page, '0000');
    await expect(page.getByTestId('pin-error')).toContainText('That PIN is not right');
    await expect(page.getByTestId('pin-error')).toContainText('4 tries left');
    for (const left of [3, 2, 1, 0]) {
      await typePin(page, '0000');
      await expect(page.getByTestId('pin-error')).toContainText(`${left} ${left === 1 ? 'try' : 'tries'} left`);
    }

    // The right PIN is now refused: the address is locked
    await typePin(page, STAFF_PIN);
    await expect(page.getByTestId('pin-locked')).toContainText('Too many tries');
    await expect(page.getByTestId('pin-locked')).toContainText(/Wait \d+ seconds?, then try again\./);
    await expect(page.getByTestId('pin-submit')).toBeDisabled();
    await expect(page.getByTestId('pin-key-4')).toBeDisabled();
    await expect(page.getByTestId('staff-view')).toHaveCount(0);
  });

  test('the right PIN opens the staff screens at the address that was asked for; Sign out returns to the PIN screen', async ({ page }) => {
    await page.goto('/staff/sales');
    await expect(page.getByTestId('pin-screen')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Staff PIN' })).toBeVisible();

    await typePin(page, STAFF_PIN);
    await expect(page.getByTestId('staff-view')).toBeVisible();
    await expect(page).toHaveURL(/\/staff\/sales$/);
    await expect(page.getByRole('heading', { name: 'Past visits and sales' })).toBeVisible();
    await expect(page.getByTestId('pin-screen')).toHaveCount(0);

    // The cookie cannot be read by the page's own scripts (HttpOnly)
    expect(await page.evaluate(() => document.cookie)).not.toContain('staff_session');

    await page.getByTestId('sign-out').click();
    await expect(page.getByTestId('pin-screen')).toBeVisible();
    await page.reload();
    await expect(page.getByTestId('pin-screen')).toBeVisible(); // the session is really over, not only hidden
    await expect(page.getByTestId('staff-view')).toHaveCount(0);
  });
});

test.describe('Flow 2: a request with no session returns the screen to the PIN screen', () => {
  test.use({ storageState: SIGNED_OUT });

  test('the session ends behind the screen; the next staff action shows the PIN screen, and a correct PIN brings the page back', async ({ page, request }) => {
    await signInAsStaff(page, request); // this test's own session, so ending it cannot sign anyone else out
    await resetTableState(request, 4); // start from a table no earlier spec left orders on
    const order = await placeOrderWithOptions(request, 4, [{ menu_item_id: 'i-01', quantity: 1 }]);
    try {
      await page.goto('/staff');
      await expect(page.getByTestId(`order-card-${order.order_number}`)).toBeVisible();

      // Sign out behind the screen's back (another device, or the 12-hour end): the page still shows the board
      expect((await request.post('/api/staff/logout')).status()).toBe(204);
      await expect(page.getByTestId('kitchen-board')).toBeVisible();

      await page.getByTestId(`btn-preparing-${order.order_number}`).click();
      await expect(page.getByTestId('pin-screen')).toBeVisible();
      await expect(page.getByTestId('kitchen-board')).toHaveCount(0);
      // The order was not changed
      const orders = (await (await request.get('/api/tables/4/orders?visit=current')).json()) as { orders: Array<{ status: string }> };
      expect(orders.orders[0].status).toBe('Pending');

      await typePin(page, STAFF_PIN);
      await expect(page.getByTestId('kitchen-board')).toBeVisible();
      await expect(page).toHaveURL(/\/staff$/);
    } finally {
      await signInAsStaff(null, request).catch(() => undefined);
      await resetTableState(request, 4);
    }
  });

  test('the staff live stream is refused without a session, and a staff route answers 401 in v1\'s error shape', async ({ request }) => {
    const stream = await request.get('/sse/staff');
    expect(stream.status()).toBe(401);
    expect((await stream.json()).error.code).toBe('UNAUTHORIZED');
    const bill = await request.get('/api/tables/5/bill');
    expect(bill.status()).toBe(401);
    expect(await bill.json()).toEqual({ error: { code: 'UNAUTHORIZED', message: expect.any(String) } });
    // A diner route needs no session
    expect((await request.get('/api/menu')).status()).toBe(200);
  });
});

test.describe('Flow 3: the theme control and its saved choice', () => {
  test('Follow device, Light and Dark change the page, and the choice is remembered after a reload', async ({ page }) => {
    await page.emulateMedia({ colorScheme: 'light' });
    await page.goto('/staff');
    await expect(page.getByTestId('staff-theme')).toBeVisible();

    // Follow device: no attribute, and the device's light setting decides
    await expect(page.getByTestId('staff-theme-device')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-theme'))).toBe(false);
    expect(await token(page, '--bg')).toBe('#F6F7F9');

    await page.getByTestId('staff-theme-dark').click();
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');
    expect(await token(page, '--bg')).toBe('#0B0D12');
    expect(await page.evaluate(() => localStorage.getItem('table-order.theme'))).toBe('dark');

    // Remembered after a reload, even though the device says light
    await page.reload();
    await expect(page.getByTestId('staff-theme-dark')).toHaveAttribute('aria-pressed', 'true');
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');
    expect(await token(page, '--bg')).toBe('#0B0D12');

    await page.getByTestId('staff-theme-light').click();
    await page.emulateMedia({ colorScheme: 'dark' }); // the device now says dark; the saved choice wins
    expect(await token(page, '--bg')).toBe('#F6F7F9');
    await page.reload();
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('light');

    // Follow device again: the saved choice and the attribute go, and the device (dark) decides
    await page.getByTestId('staff-theme-device').click();
    expect(await page.evaluate(() => localStorage.getItem('table-order.theme'))).toBeNull();
    expect(await page.evaluate(() => document.documentElement.hasAttribute('data-theme'))).toBe(false);
    expect(await token(page, '--bg')).toBe('#0B0D12');
  });

  test('the saved choice also themes the diner page, and the page background really changes', async ({ page }) => {
    // Only the first load starts as light; the script must not undo the choice made later in the test.
    await page.addInitScript(() => {
      if (!sessionStorage.getItem('seeded')) {
        sessionStorage.setItem('seeded', '1');
        localStorage.setItem('table-order.theme', 'light');
      }
    });
    await page.goto('/table/5');
    await expect(page.getByTestId('tab-bar')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('light');
    const light = await page.evaluate(() => getComputedStyle(document.querySelector('main')!.parentElement!).backgroundColor);
    await page.evaluate(() => {
      localStorage.setItem('table-order.theme', 'dark');
    });
    await page.reload();
    const dark = await page.evaluate(() => getComputedStyle(document.querySelector('main')!.parentElement!).backgroundColor);
    expect(light).not.toBe(dark);
    expect(dark).toBe('rgb(11, 13, 18)'); // the dark background of the new design system
  });
});

test.describe('Flow 4: an order with options reaches the staff board within 2 seconds', () => {
  test('placed with options while the board is open, it shows on the board and in My orders live', async ({ page, browser, request }) => {
    await resetTableState(request, 2); // start from a table no earlier spec left orders on
    try {
      await page.goto('/staff');
      await expect(page.getByTestId('kitchen-board')).toHaveAttribute('data-sse', 'connected');

      // A diner's page on table 2 is open too
      const diner = await browser.newPage({ baseURL: page.url().replace(/\/staff.*/, '') });
      await diner.goto('/table/2');
      await diner.getByTestId('tab-orders').click();
      await expect(diner.getByTestId('orders-empty')).toBeVisible();

      const started = Date.now();
      const order = await placeOrderWithOptions(request, 2, [
        { menu_item_id: 'i-04', quantity: 2, option_ids: ['oc-04-size-large', 'oc-04-extras-cheese'] },
      ]);
      expect(order.lines[0]).toMatchObject({ price_cents_each: 1850, station: 'Grill' });
      expect(order.lines[0].options.map((o) => o.label)).toEqual(['Large', 'Extra cheese']);
      expect(order.estimate_minutes).toBeGreaterThanOrEqual(1);

      // BR13.2: within 2 seconds, on both screens
      await expect(page.getByTestId(`table-section-2`)).toContainText('Classic Burger', { timeout: 2000 });
      await expect(page.getByTestId(`order-card-${order.order_number}`)).toBeVisible({ timeout: 2000 });
      await expect(diner.getByTestId(`order-card-${order.order_number}`)).toContainText('Classic Burger', { timeout: 2000 });
      // The line price (item + options, frozen) is what the diner is shown: 2 x $18.50
      await expect(diner.getByTestId(`order-card-${order.order_number}`)).toContainText('$37.00');
      expect(Date.now() - started).toBeLessThan(8000);

      // A status change reaches the diner live, too
      await moveOrder(request, order.order_number, 'Preparing');
      await expect(diner.getByTestId(`order-status-${order.order_number}`)).toContainText('Preparing', { timeout: 2000 });
      await diner.close();
    } finally {
      await resetTableState(request, 2);
    }
  });
});

test.describe('Flow 5: the last Chef\'s special goes to one diner', () => {
  test('two diners order the last one at the same moment: one wins, the other\'s line is dropped, the rest of the order is placed', async ({ page, request }) => {
    await resetTableState(request, 2);
    await resetTableState(request, 4);
    await endSpecial(request); // no special left live by an earlier test
    try {
      await page.goto('/table/4');
      await expect(page.getByTestId('tab-bar')).toBeVisible();
      await listen(page, '/sse/tables/4', ['SPECIAL_CHANGED']);

      const special = await launchSpecial(request, { item_id: 'i-04', special_price_cents: 1000, stock: 1, minutes: 30 });
      await expect.poll(async () => (await received(page, 'SPECIAL_CHANGED')).length, { timeout: 2000 }).toBeGreaterThan(0);
      expect((await received(page, 'SPECIAL_CHANGED'))[0].special).toMatchObject({ id: special.id, stock_left: 1 });
      expect(((await (await request.get('/api/specials/current')).json()) as { special: { id: string } }).special.id).toBe(special.id);

      const lines = [{ menu_item_id: 'i-04', quantity: 1, special_id: special.id }, { menu_item_id: 'i-10', quantity: 1 }];
      const [a, b] = await Promise.all([placeOrderWithOptions(request, 2, lines), placeOrderWithOptions(request, 4, lines)]);

      const dropped = [a, b].flatMap((o) => o.dropped_lines);
      expect(dropped).toEqual([{ menu_item_id: 'i-04', reason: 'SPECIAL_SOLD_OUT' }]); // exactly one lost
      const winner = [a, b].find((o) => o.dropped_lines.length === 0)!;
      const loser = [a, b].find((o) => o.dropped_lines.length === 1)!;
      expect(winner.lines.find((l) => l.menu_item_id === 'i-04')).toMatchObject({ price_cents_each: 1000, special_id: special.id });
      expect(loser.lines.map((l) => l.menu_item_id)).toEqual(['i-10']); // the rest of the order was placed

      // The sell-out reaches every open Menu at once: the special is gone
      await expect.poll(async () => (await received(page, 'SPECIAL_CHANGED')).at(-1)?.special, { timeout: 2000 }).toBeNull();
      expect(((await (await request.get('/api/specials/current')).json()) as { special: unknown }).special).toBeNull();
    } finally {
      await endSpecial(request);
      await resetTableState(request, 2);
      await resetTableState(request, 4);
    }
  });
});

test.describe('Flow 6: calls and ratings through the helpers', () => {
  test('a call opens and is answered with its events; a closed visit is rated, and a locked rating cannot change', async ({ page, request }) => {
    await resetTableState(request, 2);
    try {
      await page.goto('/staff');
      await expect(page.getByTestId('kitchen-board')).toHaveAttribute('data-sse', 'connected');
      await listen(page, '/sse/staff', ['SERVICE_CALL_OPENED', 'SERVICE_CALL_RESPONDED', 'TABLE_CLOSED']);

      // A table with no open visit cannot call
      const none = await request.post('/api/tables/2/calls', { data: { kind: 'waiter' } });
      expect(none.status()).toBe(409);

      await placeOrderWithOptions(request, 2, [{ menu_item_id: 'i-04', quantity: 1 }, { menu_item_id: 'i-12', quantity: 1 }]);
      const call = await openCall(request, 2, 'waiter');
      expect(call).toMatchObject({ kind: 'waiter', status: 'open' });
      await expect.poll(async () => (await received(page, 'SERVICE_CALL_OPENED')).length, { timeout: 2000 }).toBe(1);
      expect((await received(page, 'SERVICE_CALL_OPENED'))[0]).toMatchObject({ call_id: call.id, table_id: 2, kind: 'waiter' });
      // A second press while it is open is the same request
      expect((await openCall(request, 2, 'waiter')).id).toBe(call.id);

      await respondCall(request, call.id);
      await expect.poll(async () => (await received(page, 'SERVICE_CALL_RESPONDED')).length, { timeout: 2000 }).toBe(1);
      const list = (await (await request.get('/api/tables/2/calls')).json()) as { calls: Array<{ id: string; status: string }> };
      expect(list.calls).toEqual([expect.objectContaining({ id: call.id, status: 'responded' })]);

      // Close the table and rate the dishes; Done locks them
      const visit = await closeTableAndRate(request, 2, [{ item_id: 'i-04', thumb: 'up' }, { item_id: 'i-12', thumb: 'down' }], true);
      await expect.poll(async () => (await received(page, 'TABLE_CLOSED')).length, { timeout: 2000 }).toBe(1);
      const changed = await request.post('/api/tables/2/ratings', { data: { visit_id: visit, ratings: [{ item_id: 'i-04', thumb: 'down' }] } });
      expect(changed.status()).toBe(409);
      expect((await changed.json()).error.code).toBe('RATING_LOCKED');
      const wrongVisit = await request.post('/api/tables/2/ratings', { data: { visit_id: 'not-the-visit', ratings: [] } });
      expect((await wrongVisit.json()).error.code).toBe('VISIT_NOT_CLOSED');
    } finally {
      await resetTableState(request, 2);
    }
  });
});

test.describe('Flow 7: an open page shows as present', () => {
  test('staff are told when a diner page opens and closes, and a helper can set a table\'s count', async ({ page, browser }) => {
    await page.goto('/staff');
    await expect(page.getByTestId('kitchen-board')).toHaveAttribute('data-sse', 'connected');
    await listen(page, '/sse/staff', ['TABLE_PRESENCE_CHANGED']);
    const latest = async (table: number) => (await received(page, 'TABLE_PRESENCE_CHANGED')).filter((e) => e.table_id === table).at(-1);

    // A diner page opens its stream and sends its heartbeat by itself (the stream hook)
    const diner = await browser.newPage({ baseURL: page.url().replace(/\/staff.*/, '') });
    await diner.goto('/table/6');
    await expect(diner.getByTestId('tab-bar')).toBeVisible();
    await expect.poll(async () => (await latest(6))?.connected, { timeout: 2500 }).toBe(1);
    expect((await latest(6))!.last_activity_at).toMatch(/Z$/);

    await diner.close();
    await expect.poll(async () => (await latest(6))?.connected, { timeout: 3000 }).toBe(0);

    // The helper makes a table show three pages without three diners
    await setPresence(page, 6, 3);
    await expect.poll(async () => (await latest(6))?.connected, { timeout: 3000 }).toBe(3);
    await setPresence(page, 6, 0);
    await expect.poll(async () => (await latest(6))?.connected, { timeout: 3000 }).toBe(0);
  });
});

for (const theme of ['dark', 'light'] as const) {
  test.describe(`Flow 8: the new look keeps what v1 got right (${theme} theme)`, () => {
    test.use({ viewport: { width: 390, height: 844 }, colorScheme: theme });

    test('bottom tab bar with the Cart count, sticky category pills, and 44 px touch areas', async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('table-order.theme', t), theme);
      await page.goto('/table/5');
      await expect(page.getByTestId('menu-screen')).toBeVisible({ timeout: 8000 });
      expect(await token(page, '--bg')).toBe(theme === 'dark' ? '#0B0D12' : '#F6F7F9');
      expect(await token(page, '--accent')).toBe(theme === 'dark' ? '#FF7A3D' : '#CF430E');

      // The tab bar is fixed at the bottom of the screen, never at the top, with a word under every icon
      const bar = (await page.getByTestId('tab-bar').boundingBox())!;
      expect(Math.abs(bar.y + bar.height - 844)).toBeLessThan(1.5);
      for (const id of ['tab-menu', 'tab-cart', 'tab-orders']) {
        const box = (await page.getByTestId(id).boundingBox())!;
        expect(box.height, id).toBeGreaterThanOrEqual(44);
        expect(box.width, id).toBeGreaterThanOrEqual(44);
      }
      await expect(page.getByTestId('tab-menu')).toHaveAttribute('aria-pressed', 'true');

      // The Cart count
      await page.getByTestId('add-item-i-01').click();
      await page.getByTestId('add-item-i-02').click();
      await expect(page.getByTestId('cart-badge')).toHaveText('2');
      await expect(page.getByTestId('menu-cart-summary')).toContainText('View cart');

      // Category pills stay at the top of the scrolling area while the diner scrolls; the one on screen is filled
      const pills = page.getByTestId('category-pill-bar');
      const before = (await pills.boundingBox())!;
      await page.locator('main').evaluate((m) => m.scrollTo({ top: 700 }));
      await page.waitForTimeout(300);
      const after = (await pills.boundingBox())!;
      expect(Math.abs(after.y - before.y)).toBeLessThan(1.5);
      // exactly one pill is filled in (the category on screen), with the accent colour
      const fills = await pills.locator('button').evaluateAll((els) => els.map((el) => getComputedStyle(el).backgroundColor));
      const accent = theme === 'dark' ? 'rgb(255, 122, 61)' : 'rgb(207, 67, 14)';
      const filled = fills.filter((c) => c === accent);
      expect(fills).toHaveLength(4);
      expect(filled).toHaveLength(1);
    });

    test('regression: the + Add pill looks 36 px tall and its touch area is 44 px, even with its border', async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('table-order.theme', t), theme);
      await page.goto('/table/5');
      await expect(page.getByTestId('menu-screen')).toBeVisible({ timeout: 8000 });
      for (const id of ['add-item-i-01', 'add-item-i-04']) {
        const add = page.getByTestId(id);
        expect((await add.boundingBox())!.height).toBeCloseTo(36, 0);
        const touch = await add.evaluate((el) => {
          const after = getComputedStyle(el, '::after');
          const pill = el.getBoundingClientRect();
          return { height: parseFloat(after.height), width: parseFloat(after.width), position: after.position, pillWidth: pill.width };
        });
        expect(touch.position).toBe('absolute');
        expect(touch.height).toBe(44); // was 42 while the pill's border was counted out of an offset
        expect(touch.width).toBeGreaterThanOrEqual(44);
        expect(touch.width).toBeGreaterThanOrEqual(touch.pillWidth - 2);
      }
    });

    test('the staff screens keep 44 px buttons and show the theme control in the header', async ({ page }) => {
      await page.setViewportSize({ width: 1280, height: 800 });
      await page.addInitScript((t) => localStorage.setItem('table-order.theme', t), theme);
      await page.goto('/staff');
      await expect(page.getByTestId('kitchen-board')).toBeVisible();
      await expect(page.getByTestId(`staff-theme-${theme}`)).toHaveAttribute('aria-pressed', 'true');
      for (const name of ['Menu availability']) {
        expect((await page.getByRole('button', { name }).boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      for (const id of ['nav-board', 'nav-floor', 'sign-out']) {
        expect((await page.getByTestId(id).boundingBox())!.height, id).toBeGreaterThanOrEqual(44);
      }
    });
  });
}

test.describe('Flow 9: all motion stops under reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });

  async function longestMotion(page: Page): Promise<number> {
    return page.evaluate(() =>
      Math.max(
        0,
        ...Array.from(document.querySelectorAll('*')).map((n) => {
          const s = getComputedStyle(n);
          return Math.max(parseFloat(s.animationDuration) || 0, parseFloat(s.transitionDuration) || 0, parseFloat(s.animationDelay) || 0);
        })
      )
    );
  }

  for (const theme of ['dark', 'light'] as const) {
    test(`the diner page and the staff board have no animation or transition (${theme})`, async ({ page }) => {
      await page.addInitScript((t) => localStorage.setItem('table-order.theme', t), theme);
      await page.goto('/table/5');
      await expect(page.getByTestId('menu-screen')).toBeVisible({ timeout: 8000 });
      expect(await longestMotion(page)).toBeLessThan(0.01);
      expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');

      await page.goto('/staff');
      await expect(page.getByTestId('kitchen-board')).toBeVisible();
      expect(await longestMotion(page)).toBeLessThan(0.01);

      // State still changes without motion: the theme control works
      await page.getByTestId('staff-theme-dark').click();
      expect(await page.evaluate(() => document.documentElement.getAttribute('data-theme'))).toBe('dark');
    });
  }

  test('without the setting the same pages do animate, so the check above is not vacuous', async ({ browser }) => {
    const ctx = await browser.newContext({ reducedMotion: 'no-preference', baseURL: test.info().project.use.baseURL, storageState: 'test-results/.auth/staff.json' });
    const page = await ctx.newPage();
    await page.goto('/table/5');
    await expect(page.getByTestId('menu-screen')).toBeVisible({ timeout: 8000 });
    expect(await longestMotion(page)).toBeGreaterThan(0.1);
    await ctx.close();
  });
});
