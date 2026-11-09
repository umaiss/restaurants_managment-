import { test, expect, type Page } from '@playwright/test';
import { openCall, placeOrderWithOptions, resetTableState, signInAsStaff, STAFF_PIN } from '../helpers';

// The kitchen rings when an order comes in or a table calls the waiter or asks for the bill. The browser's audio is
// replaced by a counter, so the test counts rings (one audio context per ring) without needing a speaker.

const TABLE = 2;

async function countAudio(page: Page) {
  await page.addInitScript(() => {
    const w = window as unknown as { __rings: number; AudioContext: unknown };
    w.__rings = 0;
    class FakeAudio {
      destination = {};
      currentTime = 0;
      constructor() {
        w.__rings++;
      }
      resume() {
        return Promise.resolve();
      }
      createOscillator() {
        return { type: '', frequency: { value: 0 }, connect() {}, start() {}, stop() {} };
      }
      createGain() {
        return { gain: { value: 0, setValueAtTime() {}, exponentialRampToValueAtTime() {} }, connect() {} };
      }
      close() {
        return Promise.resolve();
      }
    }
    w.AudioContext = FakeAudio;
  });
}
const rings = (page: Page) => page.evaluate(() => (window as unknown as { __rings: number }).__rings);

test.beforeEach(async ({ request }) => {
  await signInAsStaff(null, request);
  await resetTableState(request, TABLE);
});
test.afterEach(async ({ request }) => {
  await resetTableState(request, TABLE);
});

test('signing in with the PIN screen is the tap that lets the board ring: an order, a waiter call and a bill request each ring once', async ({ browser, request, baseURL }) => {
  // a fresh browser with no staff session, so the PIN screen shows
  const context = await browser.newContext({ baseURL, storageState: { cookies: [], origins: [] } });
  const page = await context.newPage();
  await countAudio(page);
  await page.goto('/staff');
  await expect(page.getByTestId('pin-screen')).toBeVisible();
  for (const digit of STAFF_PIN) await page.getByTestId(`pin-key-${digit}`).click(); // the only taps of the visit
  await page.getByTestId('pin-submit').click();
  await expect(page.getByTestId('kitchen-board')).toBeVisible();
  await expect(page.getByTestId('kitchen-board')).toHaveAttribute('data-sse', 'connected');

  const order = await placeOrderWithOptions(request, TABLE, [{ menu_item_id: 'i-01', quantity: 1 }]);
  await expect(page.getByTestId(`new-order-alert-${order.order_number}`)).toContainText(`New order #${order.order_number} from Table ${TABLE}`);
  expect(await rings(page)).toBe(1);

  const waiter = await openCall(request, TABLE, 'waiter');
  await expect(page.getByTestId(`call-alert-${waiter.id}`)).toContainText(`Table ${TABLE} is calling the waiter`);
  expect(await rings(page)).toBe(2);

  const bill = await request.post(`/api/tables/${TABLE}/calls`, { data: { kind: 'bill', payment_method: 'cash', wants_receipt: true } });
  const billId = ((await bill.json()) as { id: string }).id;
  await expect(page.getByTestId(`call-alert-${billId}`)).toContainText('Table 2 is asking for the bill');
  await expect(page.getByTestId(`call-alert-${billId}`)).toContainText('Pays with cash, wants a receipt.');
  expect(await rings(page)).toBe(3);
  await context.close();
});

test('muted: the banners show but nothing rings', async ({ page, request }) => {
  await countAudio(page);
  await signInAsStaff(page, request);
  await page.goto('/staff');
  await expect(page.getByTestId('kitchen-board')).toHaveAttribute('data-sse', 'connected');
  await page.getByRole('button', { name: 'Muted' }).click();
  const order = await placeOrderWithOptions(request, TABLE, [{ menu_item_id: 'i-01', quantity: 1 }]);
  await expect(page.getByTestId(`new-order-alert-${order.order_number}`)).toBeVisible();
  const waiter = await openCall(request, TABLE, 'waiter');
  await expect(page.getByTestId(`call-alert-${waiter.id}`)).toBeVisible();
  expect(await rings(page)).toBe(0);
});
