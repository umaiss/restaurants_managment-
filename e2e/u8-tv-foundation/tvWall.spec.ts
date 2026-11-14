/**
 * U8 TV wall foundation: browser tests of the main flows (plan Step 9; US1.1, US1.2, US2.1, US4.1, US4.2, US5.1).
 *
 * Six flows: (1) the "TV wall" link opens a full-screen page with no navigation; (2) a signed-out /staff/tv shows
 * the PIN screen and then the TV wall; (3) an order placed by a diner appears on an open TV within 2 seconds;
 * (4) flipping the switch shows and hides the amounts on an open TV within 2 seconds; (5) a second staff page's
 * switch follows within 2 seconds; (6) takings are hidden on a fresh database.
 *
 * Every test starts signed in (the Playwright config signs in once) except flow 2. Table 9 belongs to this file and
 * the show-takings setting is put back to hidden after every test. Flow 6 runs its own server on E2E_PORT + 100 with
 * its own database file, so its database is really fresh (project rule: never a fixed port, never a shared database).
 */
import { test, expect, type APIRequestContext, type Page } from '@playwright/test';
import { E2E_PORT, STAFF_PIN, placeOrderWithOptions, resetTableState, signInAsStaff } from '../helpers';
import { startOwnServer, type OwnServer } from '../u7-staff-kitchen-features/ownServer';

const SIGNED_OUT = { cookies: [], origins: [] };
const MY_TABLE = 9;
const LIVE_MS = 2000; // NFR3: what the TV shows follows within 2 seconds

async function setShowTakings(request: APIRequestContext, value: boolean): Promise<void> {
  const res = await request.put('/api/staff/tv/settings', { data: { show_takings: value } });
  expect(res.status(), `setting show_takings to ${value}`).toBe(200);
}

/** Opens the TV wall and waits until it has its first summary and its live stream is open. */
async function openTv(page: Page): Promise<void> {
  await page.goto('/staff/tv');
  await expect(page.getByTestId('tv-wall')).toHaveAttribute('data-status', 'ready');
  await expect(page.getByTestId('tv-wall')).toHaveAttribute('data-sse', 'connected');
}

/** Opens a staff page with the navigation and waits until its switch has read the setting and its stream is open. */
async function openStaffPage(page: Page): Promise<void> {
  await page.goto('/staff');
  await expect(page.getByTestId('kitchen-board')).toHaveAttribute('data-sse', 'connected');
  await expect(page.getByRole('switch', { name: 'Show takings on TV' })).toBeVisible();
}

test.describe('the TV wall', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test.beforeEach(async ({ request }) => {
    await resetTableState(request, MY_TABLE);
    await setShowTakings(request, false);
  });
  test.afterEach(async ({ request }) => {
    await resetTableState(request, MY_TABLE);
    await setShowTakings(request, false);
  });

  test('Flow 1: the "TV wall" link opens a full-screen page with no navigation and no top bar', async ({ page }) => {
    await page.goto('/staff');
    const link = page.getByTestId('nav-tv');
    await expect(link).toHaveText('TV wall');
    await link.click();
    await expect(page).toHaveURL(/\/staff\/tv$/);
    await expect(page.getByTestId('tv-wall-title')).toHaveText('TV wall');
    await expect(page.getByTestId('tv-wall-connection')).toHaveText('Live');
    await expect(page.getByTestId('side-nav')).toHaveCount(0);
    await expect(page.getByTestId('staff-topbar')).toHaveCount(0);
    // the page fills the window
    const box = await page.getByTestId('tv-wall').boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(1280 - 1);
    expect(box!.height).toBeGreaterThanOrEqual(800 - 1);
  });

  test('Flow 3: an order placed by a diner appears on the open TV within 2 seconds, with its table, portions and minutes', async ({ page, request }) => {
    await openTv(page);
    const order = await placeOrderWithOptions(request, MY_TABLE, [{ menu_item_id: 'i-04', quantity: 2 }, { menu_item_id: 'i-10', quantity: 1 }]);
    const row = page.getByTestId(`tv-order-${order.order_number}`);
    await expect(row).toBeVisible({ timeout: LIVE_MS });
    await expect(row).toContainText(`Table ${MY_TABLE}`);
    await expect(page.getByTestId(`tv-order-${order.order_number}-portions`)).toHaveText('3 portions');
    await expect(page.getByTestId(`tv-order-${order.order_number}-minutes`)).toHaveText('0 min');
    await expect(page.getByTestId('tv-wall-busiest')).not.toHaveText('No orders yet');
  });

  test('Flow 4: flipping the switch on a staff page shows and hides the amounts on an open TV within 2 seconds', async ({ page }) => {
    await openTv(page);
    await expect(page.getByTestId('tv-wall-closed')).toHaveText('Takings hidden');
    await expect(page.getByTestId('tv-wall-open')).toHaveText('Takings hidden');

    const staff = await page.context().newPage();
    await openStaffPage(staff);
    const toggle = staff.getByRole('switch', { name: 'Show takings on TV' });
    await expect(toggle).toHaveAttribute('aria-checked', 'false');

    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'true');
    await expect(staff.getByTestId('tv-takings-switch-state')).toHaveText('On');
    await expect(page.getByTestId('tv-wall-closed')).toHaveText(/^\$\d+\.\d\d$/, { timeout: LIVE_MS });
    await expect(page.getByTestId('tv-wall-open')).toHaveText(/^\$\d+\.\d\d$/, { timeout: LIVE_MS });

    await expect(toggle).toHaveAttribute('aria-busy', 'false');
    await toggle.click();
    await expect(toggle).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('tv-wall-closed')).toHaveText('Takings hidden', { timeout: LIVE_MS });
    await expect(page.getByTestId('tv-wall-open')).toHaveText('Takings hidden', { timeout: LIVE_MS });
    await staff.close();
  });

  test('Flow 5: a second staff page\'s switch follows within 2 seconds, and works from the keyboard', async ({ page }) => {
    await openStaffPage(page);
    const other = await page.context().newPage();
    await openStaffPage(other);

    const mine = page.getByRole('switch', { name: 'Show takings on TV' });
    await mine.focus();
    await page.keyboard.press('Space');
    await expect(mine).toHaveAttribute('aria-checked', 'true');
    await expect(other.getByRole('switch', { name: 'Show takings on TV' })).toHaveAttribute('aria-checked', 'true', { timeout: LIVE_MS });
    await expect(other.getByTestId('tv-takings-switch-state')).toHaveText('On', { timeout: LIVE_MS });

    await expect(mine).toHaveAttribute('aria-busy', 'false'); // the first save has answered; a press during a save is ignored
    await page.keyboard.press('Enter');
    await expect(mine).toHaveAttribute('aria-checked', 'false');
    await expect(other.getByRole('switch', { name: 'Show takings on TV' })).toHaveAttribute('aria-checked', 'false', { timeout: LIVE_MS });
    // the switch row keeps a 44 px touch area
    expect((await mine.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await other.close();
  });
});

test.describe('Flow 2: a signed-out TV asks for the PIN first', () => {
  test.use({ storageState: SIGNED_OUT, viewport: { width: 1280, height: 800 } });

  test('a signed-out /staff/tv shows the PIN screen, and the correct PIN opens the TV wall at the same address', async ({ page, request }) => {
    expect((await request.get('/api/staff/tv/summary')).status()).toBe(401); // no data without a session
    await page.goto('/staff/tv');
    await expect(page.getByTestId('pin-screen')).toBeVisible();
    await expect(page.getByTestId('tv-wall')).toHaveCount(0);
    await page.keyboard.type(STAFF_PIN);
    await page.keyboard.press('Enter');
    await expect(page.getByTestId('tv-wall')).toBeVisible();
    await expect(page).toHaveURL(/\/staff\/tv$/);
    await expect(page.getByTestId('side-nav')).toHaveCount(0);
    await expect(page.getByTestId('pin-screen')).toHaveCount(0);
  });
});

test.describe('Flow 6: a fresh database', () => {
  let server: OwnServer;
  test.beforeAll(async () => {
    server = await startOwnServer(E2E_PORT + 100, 'u8-tv-fresh.db');
  });
  test.afterAll(async () => {
    await server?.stop();
  });

  test('takings are hidden on a fresh database: the setting reads hidden, the TV says so and the switch is Off', async ({ browser }) => {
    const settings = await server.api.get('/api/staff/tv/settings');
    expect(await settings.json()).toEqual({ show_takings: false, updated_at: null });
    const summary = (await (await server.api.get('/api/staff/tv/summary')).json()) as Record<string, unknown>;
    expect(summary.show_takings).toBe(false);
    expect('takings' in summary).toBe(false);

    const context = await browser.newContext({ baseURL: server.origin, viewport: { width: 1280, height: 800 } });
    const page = await context.newPage();
    await signInAsStaff(page, server.api);
    await page.goto('/staff/tv');
    await expect(page.getByTestId('tv-wall-closed')).toHaveText('Takings hidden');
    await expect(page.getByTestId('tv-wall-open')).toHaveText('Takings hidden');
    await page.goto('/staff');
    await expect(page.getByRole('switch', { name: 'Show takings on TV' })).toHaveAttribute('aria-checked', 'false');
    await expect(page.getByTestId('tv-takings-switch-state')).toHaveText('Off');
    await context.close();
  });
});
